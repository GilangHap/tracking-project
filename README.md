# Project Tracking & QR Clock In-Out

Aplikasi web pencatatan jam kerja project via QR Code. Admin membuat project (nama + process) dan mendapat QR unik; operator scan dari HP untuk Clock In / Clock Out tanpa login. Durasi dihitung otomatis, rekap bisa diexport CSV.

Stack: Next.js 16 + TypeScript + Tailwind, **PostgreSQL 16 + Auth.js v5** (self-host), deploy Docker Compose + Caddy di VPS.

## Struktur

```text
app/            ← routes: /, /login, /admin/*, /scan, /scan/[qr_token]
components/     ← ui, loader, tabbar, logout-button, login/correction form
lib/            ← db (pg pool), auth (Auth.js), types, format WIB, search
db/init/        ← skema konsolidasi Postgres self-hosted (compose)
supabase/       ← ARSIP era Supabase, jangan dipakai lagi
docs/           ← PRD + ERD & RPC Spec
scripts/        ← backup.sh, seed-admin.mjs
```

## Dev lokal (Postgres via Docker)

```bash
# 1. Isi .env untuk dev (lihat .env.example). Lalu naikkan database saja
#    (skema otomatis dari db/init, port 5433 via docker-compose.override.yml)
docker compose up -d postgres

# 2. Buat admin pertama
node scripts/seed-admin.mjs admin@contoh.id PasswordKuat123

npm install
npm run dev   # buka /admin/dashboard
```
> `docker-compose.override.yml` khusus dev (tidak ikut ke VPS) dan `.env`
> lokal sudah di-gitignore. Di VPS pakai `.env` berisi nilai production.

## Deploy VPS (Ubuntu + Docker)

```bash
# 0. Di VPS: install Docker + compose plugin, arahkan DNS A tracking.langhap.dev → IP VPS,
#    buka port 80/443.
# 1. Clone repo, isi .env (contoh: .env.example):
#      POSTGRES_PASSWORD=<acak 16+ char>
#      AUTH_SECRET=$(openssl rand -base64 32)
#      APP_URL=https://tracking.langhap.dev
#      NEXT_PUBLIC_SITE_URL=https://tracking.langhap.dev
# 2. Jalan:
docker compose up -d --build
# 3. Tunggu postgres sehat, buat admin (hash di laptop, insert di VPS):
node -e "console.log(require('bcryptjs').hashSync('PasswordKuat123',12))"
docker compose exec postgres psql -U tracker -d tracker -c \
  "insert into public.users(email,password_hash,role) values('admin@contoh.id','<HASH>','admin');"
# 4. Cek: https://tracking.langhap.dev (Caddy menerbitkan TLS otomatis)
#    Backup harian otomatis 02:00 ke volume pgbackups (retensi 7 hari).
#    Lihat: docker compose exec backup ls -la /backups
#
# PERINGATAN: jangan ganti POSTGRES_PASSWORD di .env setelah database terisi —
# password hanya dipakai saat init volume kosong. Ganti password = lewat
# `ALTER USER tracker PASSWORD '...'` di psql, atau reset total
# (`down` + hapus volume pgdata + up ulang + seed admin lagi).
```

## Perintah

```bash
npm run dev     # development
npm run build   # typecheck + production build (wajib hijau sebelum deploy)
npm run lint    # eslint
```
