-- Migration: 0007_clock_toggle_intent
-- Compare-and-swap: clock_toggle menerima aksi yang TAMPIL di layar pemindai.
-- Kalau state berubah sejak itu (scan ganda / HP lain lebih dulu),
-- tolak dengan STALE_STATE alih-alih diam-diam membalik IN↔OUT.
-- Butuh 0003 (tanda tangan 2-arg) sudah jalan dulu. Jalankan di SQL Editor.

drop function if exists public.clock_toggle(uuid, text);

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
grant execute on function public.clock_toggle(uuid, text, text) to anon, authenticated;
