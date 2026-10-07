-- Migration: 0002_drop_project_date — PRD v1.2
-- Tanggal keluar dari tabel projects. Setiap record session membawa
-- tanggal/waktunya sendiri via clock_in (timestamptz UTC).
-- Jalankan di Supabase SQL Editor setelah 0001_init.sql.

alter table public.projects drop column if exists project_date;

-- get_scan_project tanpa project_date (kontrak baru untuk halaman scan).
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
    'last_clock_in', v_last.clock_in,
    'last_clock_out', v_last.clock_out
  );
end $$;
