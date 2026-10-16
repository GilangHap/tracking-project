-- Skema konsolidasi untuk Postgres self-hosted (VPS, fresh start).
-- Dipakai oleh docker compose via /docker-entrypoint-initdb.d.
-- Riwayat supabase/migrations/* hanya arsip era Supabase, JANGAN dijalankan di sini.
-- Perbedaan vs era Supabase: tanpa RLS (otorisasi di lapisan aplikasi via
-- Auth.js), tanpa skema/role auth/anon, audit admin via setting sesi app.admin_id.

create extension if not exists "pgcrypto";

-- 1. Enum process -------------------------------------------------------------
do $$ begin
  create type project_process as enum ('Machining', 'Assembly', 'Trial', 'Design');
exception when duplicate_object then null;
end $$;

-- 2. Users (Auth.js credentials; Auth.js sendiri tidak butuh tabel tambahan
--    karena session JWT, bukan database session) ------------------------------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);

-- 3. Projects ------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(both ' ' from name)) > 0),
  process project_process not null,
  qr_token uuid not null unique default gen_random_uuid(),
  client_key uuid unique,
  is_archived boolean not null default false,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uniq_projects_qr_token on public.projects (qr_token);
create unique index if not exists uniq_projects_client_key on public.projects (client_key);
create index if not exists idx_projects_archived_created on public.projects (is_archived, created_at desc);

-- 4. Work sessions --------------------------------------------------------------
create table if not exists public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  clock_in_by text,
  clock_out_by text,
  duration interval generated always as (clock_out - clock_in) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_clock_order check (clock_out is null or clock_out > clock_in),
  constraint chk_in_by_valid check (
    clock_in_by is null or (char_length(trim(both ' ' from clock_in_by)) between 1 and 100)
  ),
  constraint chk_out_by_valid check (
    clock_out_by is null or (char_length(trim(both ' ' from clock_out_by)) between 1 and 100)
  )
);
create unique index if not exists uniq_active_session
  on public.work_sessions (project_id) where clock_out is null;
create index if not exists idx_sessions_project_time
  on public.work_sessions (project_id, clock_in desc);

-- 5. Audit koreksi ---------------------------------------------------------------
create table if not exists public.session_corrections (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.work_sessions (id) on delete set null,
  project_id uuid not null references public.projects (id) on delete restrict,
  admin_id uuid references public.users (id) on delete set null,
  action text not null check (action in ('UPDATE', 'DELETE')),
  old_clock_in timestamptz,
  new_clock_in timestamptz,
  old_clock_out timestamptz,
  new_clock_out timestamptz,
  old_clock_in_by text,
  new_clock_in_by text,
  old_clock_out_by text,
  new_clock_out_by text,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_corrections_session on public.session_corrections (session_id);
create index if not exists idx_corrections_project_time
  on public.session_corrections (project_id, created_at desc);

-- 6. Trigger updated_at -----------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_projects_updated on public.projects;
create trigger trg_projects_updated
  before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists trg_sessions_updated on public.work_sessions;
create trigger trg_sessions_updated
  before update on public.work_sessions
  for each row execute function public.set_updated_at();

-- 7. Admin check via setting sesi (di-set aplikasi per transaksi) ------------------
-- Aplikasi WAJIB: SELECT set_config('app.admin_id', '<users.id>', true)
-- di dalam transaksi sebelum memanggil correct_session/delete_session.
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.users
    where id::text = nullif(current_setting('app.admin_id', true), '')
      and role = 'admin'
  );
$$;

create or replace function public.current_admin_id()
returns uuid language sql stable as $$
  select nullif(current_setting('app.admin_id', true), '')::uuid;
$$;

-- 8. Views status + total -----------------------------------------------------------
create or replace view public.v_project_status as
select
  p.id as project_id,
  p.is_archived,
  count(s.id)::int as session_count,
  count(s.id) filter (where s.clock_out is null)::int as active_count,
  case
    when p.is_archived then 'Archived'
    when count(s.id) = 0 then 'Not Started'
    when count(s.id) filter (where s.clock_out is null) > 0 then 'Ongoing'
    else 'Completed'
  end as status
from public.projects p
left join public.work_sessions s on s.project_id = p.id
group by p.id, p.is_archived;

create or replace view public.v_project_totals as
select
  p.id as project_id,
  count(s.id) filter (where s.clock_out is not null)::int as finished_sessions,
  coalesce(sum(extract(epoch from s.duration)) filter (where s.clock_out is not null), 0)::bigint as total_secs
from public.projects p
left join public.work_sessions s on s.project_id = p.id
group by p.id;

-- 9. RPC clock_toggle (single writer, atomic; nama operator wajib) --------------------
-- v1.7: p_expected_action = aksi yang TAMPIL di layar pemindai (compare-and-swap).
-- Kalau state sudah berubah sejak layar dibuka (scan ganda/beda HP),
-- tolak dengan STALE_STATE alih-alih diam-diam membalik aksi.
create or replace function public.clock_toggle(p_qr_token uuid, p_operator_name text, p_expected_action text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_p public.projects%rowtype;
  v_active public.work_sessions%rowtype;
  v_new public.work_sessions%rowtype;
  v_name text := trim(both ' ' from coalesce(p_operator_name, ''));
  v_actual text;
begin
  if v_name = '' then
    raise exception 'OPERATOR_REQUIRED';
  end if;
  if char_length(v_name) > 100 then
    raise exception 'OPERATOR_INVALID';
  end if;
  if p_expected_action is not null
     and upper(p_expected_action) not in ('IN', 'OUT') then
    raise exception 'INVALID_EXPECTED';
  end if;

  select * into v_p from public.projects where qr_token = p_qr_token for update;
  if not found then
    raise exception 'PROJECT_NOT_FOUND';
  end if;
  if v_p.is_archived then
    raise exception 'PROJECT_ARCHIVED';
  end if;

  select * into v_active from public.work_sessions
    where project_id = v_p.id and clock_out is null for update;

  v_actual := case when v_active.id is null then 'IN' else 'OUT' end;
  if p_expected_action is not null and v_actual <> upper(p_expected_action) then
    raise exception 'STALE_STATE';
  end if;

  if v_active.id is null then
    insert into public.work_sessions (project_id, clock_in, clock_in_by)
      values (v_p.id, now(), v_name) returning * into v_new;
    return jsonb_build_object(
      'action', 'IN', 'project_id', v_p.id, 'session_id', v_new.id,
      'clock_in', v_new.clock_in, 'clock_out', null,
      'clock_in_by', v_new.clock_in_by, 'clock_out_by', null,
      'project_status', 'Ongoing'
    );
  else
    update public.work_sessions set clock_out = now(), clock_out_by = v_name
      where id = v_active.id returning * into v_new;
    return jsonb_build_object(
      'action', 'OUT', 'project_id', v_p.id, 'session_id', v_new.id,
      'clock_in', v_new.clock_in, 'clock_out', v_new.clock_out,
      'clock_in_by', v_new.clock_in_by, 'clock_out_by', v_new.clock_out_by,
      'duration_secs', extract(epoch from v_new.duration)::bigint,
      'project_status', 'Completed'
    );
  end if;
exception when unique_violation then
  raise exception 'CONCURRENT_CONFLICT';
end $$;

-- 10. RPC get_scan_project ------------------------------------------------------------
create or replace function public.get_scan_project(p_qr_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_p public.projects%rowtype;
  v_active public.work_sessions%rowtype;
  v_last public.work_sessions%rowtype;
begin
  select * into v_p from public.projects where qr_token = p_qr_token;
  if not found then
    raise exception 'PROJECT_NOT_FOUND';
  end if;

  select * into v_active from public.work_sessions
    where project_id = v_p.id and clock_out is null limit 1;

  select * into v_last from public.work_sessions
    where project_id = v_p.id order by clock_in desc limit 1;

  return jsonb_build_object(
    'project_id', v_p.id,
    'name', v_p.name,
    'process', v_p.process::text,
    'is_archived', v_p.is_archived,
    'next_action', case when v_active.id is null then 'IN' else 'OUT' end,
    'active_clock_in', v_active.clock_in,
    'active_clock_in_by', v_active.clock_in_by,
    'last_clock_in', v_last.clock_in,
    'last_clock_out', v_last.clock_out,
    'last_clock_in_by', v_last.clock_in_by,
    'last_clock_out_by', v_last.clock_out_by
  );
end $$;

-- 11. RPC correct_session (admin only, via app.admin_id) ---------------------------------
create or replace function public.correct_session(
  p_session_id uuid, p_new_in timestamptz, p_new_out timestamptz, p_reason text default null,
  p_new_in_by text default null, p_new_out_by text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_s public.work_sessions%rowtype;
  v_overlap int;
  v_active_other int;
  v_in_by text := nullif(trim(both ' ' from coalesce(p_new_in_by, '')), '');
  v_out_by text := nullif(trim(both ' ' from coalesce(p_new_out_by, '')), '');
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN_NOT_ADMIN';
  end if;

  select * into v_s from public.work_sessions where id = p_session_id for update;
  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if p_new_out is not null and p_new_out <= p_new_in then
    raise exception 'INVALID_TIME_ORDER';
  end if;

  select count(*)::int into v_overlap from public.work_sessions
    where project_id = v_s.project_id and id <> v_s.id
      and tstzrange(clock_in, coalesce(clock_out, 'infinity'::timestamptz), '[)')
        && tstzrange(p_new_in, coalesce(p_new_out, 'infinity'::timestamptz), '[)');
  if v_overlap > 0 then
    raise exception 'SESSION_OVERLAP';
  end if;

  if p_new_out is null then
    select count(*)::int into v_active_other from public.work_sessions
      where project_id = v_s.project_id and id <> v_s.id and clock_out is null;
    if v_active_other > 0 then
      raise exception 'MULTIPLE_ACTIVE_FORBIDDEN';
    end if;
  end if;

  update public.work_sessions
    set clock_in = p_new_in, clock_out = p_new_out,
        clock_in_by = v_in_by, clock_out_by = v_out_by
    where id = p_session_id;

  insert into public.session_corrections
    (session_id, project_id, admin_id, action,
     old_clock_in, new_clock_in, old_clock_out, new_clock_out,
     old_clock_in_by, new_clock_in_by, old_clock_out_by, new_clock_out_by, reason)
    values (p_session_id, v_s.project_id, public.current_admin_id(), 'UPDATE',
      v_s.clock_in, p_new_in, v_s.clock_out, p_new_out,
      v_s.clock_in_by, v_in_by, v_s.clock_out_by, v_out_by, p_reason);

  return jsonb_build_object('ok', true, 'session_id', p_session_id);
end $$;

-- 12. RPC delete_session ------------------------------------------------------------------
create or replace function public.delete_session(p_session_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_s public.work_sessions%rowtype;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN_NOT_ADMIN';
  end if;
  select * into v_s from public.work_sessions where id = p_session_id;
  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  insert into public.session_corrections
    (session_id, project_id, admin_id, action,
     old_clock_in, new_clock_in, old_clock_out, new_clock_out,
     old_clock_in_by, new_clock_in_by, old_clock_out_by, new_clock_out_by, reason)
    values (p_session_id, v_s.project_id, public.current_admin_id(), 'DELETE',
      v_s.clock_in, null, v_s.clock_out, null,
      v_s.clock_in_by, null, v_s.clock_out_by, null, p_reason);

  delete from public.work_sessions where id = p_session_id;
  return jsonb_build_object('ok', true, 'deleted_session_id', p_session_id);
end $$;
