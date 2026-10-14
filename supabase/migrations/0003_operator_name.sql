-- Migration: 0003_operator_name — PRD v1.4
-- Nama operator wajib diisi sebelum Clock In maupun Clock Out.
-- Dicatat per event (clock_in_by / clock_out_by) karena yang IN
-- dan yang OUT bisa beda orang (ganti shift).
-- Jalankan di Supabase SQL Editor setelah 0002.

alter table public.work_sessions
  add column if not exists clock_in_by text,
  add column if not exists clock_out_by text;

alter table public.work_sessions
  drop constraint if exists chk_in_by_valid;
alter table public.work_sessions
  add constraint chk_in_by_valid check (
    clock_in_by is null or (char_length(trim(both ' ' from clock_in_by)) between 1 and 100)
  );

alter table public.work_sessions
  drop constraint if exists chk_out_by_valid;
alter table public.work_sessions
  add constraint chk_out_by_valid check (
    clock_out_by is null or (char_length(trim(both ' ' from clock_out_by)) between 1 and 100)
  );

alter table public.session_corrections
  add column if not exists old_clock_in_by text,
  add column if not exists new_clock_in_by text,
  add column if not exists old_clock_out_by text,
  add column if not exists new_clock_out_by text;

-- clock_toggle: tanda tangan berubah (tambah nama) → drop overload lama dulu.
drop function if exists public.clock_toggle(uuid);

create or replace function public.clock_toggle(p_qr_token uuid, p_operator_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_p public.projects%rowtype;
  v_active public.work_sessions%rowtype;
  v_new public.work_sessions%rowtype;
  v_name text := trim(both ' ' from coalesce(p_operator_name, ''));
begin
  if v_name = '' then
    raise exception 'OPERATOR_REQUIRED';
  end if;
  if char_length(v_name) > 100 then
    raise exception 'OPERATOR_INVALID';
  end if;

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
  -- Lolos race di level aplikasi, tertahan unique index → minta refresh
  raise exception 'CONCURRENT_CONFLICT';
end $$;
grant execute on function public.clock_toggle(uuid, text) to anon, authenticated;

-- get_scan_project: sertakan nama operator terakhir/aktif.
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
grant execute on function public.get_scan_project(uuid) to anon, authenticated;

-- correct_session: tambah koreksi nama (tanda tangan berubah → drop lama).
drop function if exists public.correct_session(uuid, timestamptz, timestamptz, text);

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
    set clock_in = p_new_in, clock_out = p_new_out,
        clock_in_by = v_in_by, clock_out_by = v_out_by
    where id = p_session_id;

  insert into public.session_corrections
    (session_id, project_id, admin_id, action,
     old_clock_in, new_clock_in, old_clock_out, new_clock_out,
     old_clock_in_by, new_clock_in_by, old_clock_out_by, new_clock_out_by, reason)
    values (p_session_id, v_s.project_id, auth.uid(), 'UPDATE',
      v_s.clock_in, p_new_in, v_s.clock_out, p_new_out,
      v_s.clock_in_by, v_in_by, v_s.clock_out_by, v_out_by, p_reason);

  return jsonb_build_object('ok', true, 'session_id', p_session_id);
end $$;
revoke all on function public.correct_session(uuid, timestamptz, timestamptz, text, text, text) from anon;
grant execute on function public.correct_session(uuid, timestamptz, timestamptz, text, text, text) to authenticated;

-- delete_session: audit ikut mencatat nama.
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
    values (p_session_id, v_s.project_id, auth.uid(), 'DELETE',
      v_s.clock_in, null, v_s.clock_out, null,
      v_s.clock_in_by, null, v_s.clock_out_by, null, p_reason);

  delete from public.work_sessions where id = p_session_id;
  return jsonb_build_object('ok', true, 'deleted_session_id', p_session_id);
end $$;
revoke all on function public.delete_session(uuid, text) from anon;
grant execute on function public.delete_session(uuid, text) to authenticated;
