# Project Tracking & QR Clock In-Out

Aplikasi web pencatatan jam kerja project via QR Code. Admin membuat project (nama + process) dan mendapat QR unik; operator scan dari HP untuk Clock In / Clock Out tanpa login. Durasi dihitung otomatis, rekap bisa diexport CSV.

Stack: Next.js 16 + TypeScript + Tailwind, Supabase (Postgres + Auth + RLS + RPC), deploy Vercel.

## Struktur

```text
app/            ← routes: /, /login, /admin/*, /scan, /scan/[qr_token]
components/     ← ui, loader, tabbar, logout-button
lib/            ← supabase client/server, types, format WIB, search
supabase/migrations/ ← 0001 skema + RPC, 0002 hapus project_date
docs/           ← PRD v1.3 + ERD & RPC Spec
```

## Setup lokal

1. Buat project Supabase → jalankan `supabase/migrations/0001_init.sql`
   lalu `0002_drop_project_date.sql` di SQL Editor.
2. Authentication → Add user (centang Auto Confirm) → catat UID →
   `insert into public.admins(user_id) values ('<UID>');`
3. Copy `.env.example` → `.env.local`, isi 3 variabel.
4. `npm install` → `npm run dev` → buka `/admin/dashboard`.

## Perintah

```bash
npm run dev     # development
npm run build   # typecheck + production build (wajib hijau sebelum deploy)
npm run lint    # eslint
```

Deploy Vercel: root directory = repo ini, isi env yang sama + `NEXT_PUBLIC_SITE_URL`
dengan domain production (penting — QR dicetak dari URL ini).
