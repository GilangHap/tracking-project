-- Migration: 0004_idempotency — anti project ganda akibat klik ganda.
-- Setiap render form create membawa client_key unik; submit ganda
-- (klik double, retry jaringan) dengan key sama hanya membuat 1 project.
-- Jalankan di Supabase SQL Editor setelah 0003.

alter table public.projects
  add column if not exists client_key uuid;

-- Nullable + unique: NULL bebas ganda (baris lama), nilai terisi unik.
create unique index if not exists uniq_projects_client_key
  on public.projects (client_key);
