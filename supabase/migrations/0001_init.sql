-- Migration: 0001_init — Project Tracking & QR Clock In-Out System (PRD v1.1 locked)
-- Jalankan di Supabase SQL Editor / supabase db push.
-- Asumsi: schema public, extension pgcrypto tersedia.

-- 0. Extension ---------------------------------------------------------------
create extension if not exists "pgcrypto";

-- 1. Enum process (1 project = 1 process, locked v1.1) ------------------------
do $$ begin
  create type project_process as enum ('Machining', 'Assembly', 'Trial');
exception when duplicate_object then null;
end $$;

-- 2. Tabel admins (penentu role admin, dipakai RLS + RPC) --------------------
-- Cara pakai: insert manual 1 baris user_id admin pertama setelah signup.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 3. Tabel projects -----------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  project_date date not null,
  name text not null check (char_length(trim(both ' ' from name)) > 0),
  process project_process not null,
  qr_token uuid not null unique default gen_random_uuid(),
  is_archived boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uniq_projects_qr_token on public.projects (qr_token);
create index if not exists idx_projects_archived_date on public.projects (is_archived, project_date desc);

-- 4. Tabel work_sessions ------------------------------------------------------
create table if not exists public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  duration interval generated always as (clock_out - clock_in) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_clock_order check (clock_out is null or clock_out > clock_in)
);
-- Serial murni: max 1 active session per project (LOCKED v1.1)
create unique index if not exists uniq_active_session
  on public.work_sessions (project_id) where clock_out is null;
create index if not exists idx_sessions_project_time
  on public.work_sessions (project_id, clock_in desc);

-- 5. Tabel audit koreksi (MVP) -------------------------------------------------
create table if not exists public.session_corrections (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.work_sessions (id) on delete set null,
  project_id uuid not null references public.projects (id) on delete restrict,
  admin_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('UPDATE', 'DELETE')),
  old_clock_in timestamptz,
  new_clock_in timestamptz,
  old_clock_out timestamptz,
  new_clock_out timestamptz,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_corrections_session on public.session_corrections (session_id);
create index if not exists idx_corrections_project_time
  on public.session_corrections (project_id, created_at desc);

-- 6. Trigger updated_at --------------------------------------------------------
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

-- 7. Helper is_admin ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- 8. Views derived status + totals ---------------------------------------------
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

-- Views tunduk pada RLS penanya (bukan owner), agar anon tidak bisa intip via view.
alter view public.v_project_status set (security_invoker = true);
alter view public.v_project_totals set (security_invoker = true);

-- 9. RPC public: get_scan_project (ganti SELECT langsung untuk anon) ------------
-- Mengembalikan info minimal halaman scan + deterrent fraud (clock_in terakhir).
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
    'project_date', v_p.project_date,
    'is_archived', v_p.is_archived,
    'next_action', case when v_active.id is null then 'IN' else 'OUT' end,
    'active_clock_in', v_active.clock_in,
    'last_clock_in', v_last.clock_in,
    'last_clock_out', v_last.clock_out
  );
end $$;
grant execute on function public.get_scan_project(uuid) to anon, authenticated;

-- 10. RPC single writer: clock_toggle (LOCKED v1.1) ------------------------------
create or replace function public.clock_toggle(p_qr_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_p public.projects%rowtype;
  v_active public.work_sessions%rowtype;
  v_new public.work_sessions%rowtype;
begin
  -- Lock project agar 2 scan bareng tidak lolos
  select * into v_p from public.projects where qr_token = p_qr_token for update;
  if not found then
    raise exception 'PROJECT_NOT_FOUND';
  end if;
  if v_p.is_archived then
    raise exception 'PROJECT_ARCHIVED';
  end if;

  select * into v_active from public.work_sessions
    where project_id = v_p.id and clock_out is null for update;

  if v_active.id is null then
    insert into public.work_sessions (project_id, clock_in)
      values (v_p.id, now()) returning * into v_new;
    return jsonb_build_object(
      'action', 'IN', 'project_id', v_p.id, 'session_id', v_new.id,
      'clock_in', v_new.clock_in, 'clock_out', null,
      'project_status', 'Ongoing'
    );
  else
    update public.work_sessions set clock_out = now()
      where id = v_active.id returning * into v_new;
    return jsonb_build_object(
      'action', 'OUT', 'project_id', v_p.id, 'session_id', v_new.id,
      'clock_in', v_new.clock_in, 'clock_out', v_new.clock_out,
      'duration_secs', extract(epoch from v_new.duration)::bigint,
      'project_status', 'Completed'
    );
  end if;
exception when unique_violation then
  -- Lolos race di level aplikasi, tertahan unique index → minta refresh
  raise exception 'CONCURRENT_CONFLICT';
end $$;
grant execute on function public.clock_toggle(uuid) to anon, authenticated;

-- 11. RPC admin: correct_session (MVP) -------------------------------------------
-- p_new_out = NULL artinya session kembali aktif (hati-hati: max 1 aktif).
create or replace function public.correct_session(
  p_session_id uuid, p_new_in timestamptz, p_new_out timestamptz, p_reason text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_s public.work_sessions%rowtype;
  v_overlap int;
  v_active_other int;
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

  -- Tolak overlap dengan session lain project yang sama
  select count(*)::int into v_overlap from public.work_sessions
    where project_id = v_s.project_id and id <> v_s.id
      and tstzrange(clock_in, coalesce(clock_out, 'infinity'::timestamptz), '[)')
        && tstzrange(p_new_in, coalesce(p_new_out, 'infinity'::timestamptz), '[)');
  if v_overlap > 0 then
    raise exception 'SESSION_OVERLAP';
  end if;

  -- Tolak jika membuat 2 active session
  if p_new_out is null then
    select count(*)::int into v_active_other from public.work_sessions
      where project_id = v_s.project_id and id <> v_s.id and clock_out is null;
    if v_active_other > 0 then
      raise exception 'MULTIPLE_ACTIVE_FORBIDDEN';
    end if;
  end if;

  update public.work_sessions
    set clock_in = p_new_in, clock_out = p_new_out
    where id = p_session_id;

  insert into public.session_corrections
    (session_id, project_id, admin_id, action, old_clock_in, new_clock_in, old_clock_out, new_clock_out, reason)
    values (p_session_id, v_s.project_id, auth.uid(), 'UPDATE',
      v_s.clock_in, p_new_in, v_s.clock_out, p_new_out, p_reason);

  return jsonb_build_object('ok', true, 'session_id', p_session_id);
end $$;
revoke all on function public.correct_session(uuid, timestamptz, timestamptz, text) from anon;
grant execute on function public.correct_session(uuid, timestamptz, timestamptz, text) to authenticated;

-- Hapus session salah (audit DELETE). Session aktif boleh dihapus (darurat).
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
    (session_id, project_id, admin_id, action, old_clock_in, new_clock_in, old_clock_out, new_clock_out, reason)
    values (p_session_id, v_s.project_id, auth.uid(), 'DELETE',
      v_s.clock_in, null, v_s.clock_out, null, p_reason);

  delete from public.work_sessions where id = p_session_id;
  return jsonb_build_object('ok', true, 'deleted_session_id', p_session_id);
end $$;
revoke all on function public.delete_session(uuid, text) from anon;
grant execute on function public.delete_session(uuid, text) to authenticated;

-- 12. RLS: kunci akses langsung, paksa lewat RPC ---------------------------------
alter table public.projects enable row level security;
alter table public.work_sessions enable row level security;
alter table public.session_corrections enable row level security;
alter table public.admins enable row level security;

-- Admins: hanya admin yang bisa baca (plus self-check agar is_admin jalan:
-- is_admin() adalah SECURITY DEFINER sehingga lolos RLS di dalamnya).
drop policy if exists admins_admin_read on public.admins;
create policy admins_admin_read on public.admins
  for select to authenticated using (public.is_admin() or user_id = auth.uid());

-- Projects: full CRUD hanya admin. Anon DITOLAK (pakai get_scan_project).
drop policy if exists projects_admin_all on public.projects;
create policy projects_admin_all on public.projects
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Sessions: full CRUD hanya admin. Anon DITOLAK (pakai clock_toggle).
drop policy if exists sessions_admin_all on public.work_sessions;
create policy sessions_admin_all on public.work_sessions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Corrections: read/insert hanya admin (insert juga dilakukan RPC correct/delete).
drop policy if exists corrections_admin_all on public.session_corrections;
create policy corrections_admin_all on public.session_corrections
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Views: ikut RLS tabel dasar (admin only). Halaman public JANGAN query view langsung.
