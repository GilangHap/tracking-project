# ERD & RPC Spec — Project Tracking & QR Clock In-Out System

**Version:** 1.2 (07 Oct 2026)
**Changelog v1.2:** `project_date` dihapus (migration 0002). Tanggal ikut tiap record via `clock_in`. Dashboard = rekap record terbaru. `get_scan_project` tanpa `project_date`.
**PRD:** `Product Requirements Document — Project Tracking & QR Clock In-Out System.md` v1.1
**Stack:** Next.js + TypeScript, Supabase (Postgres + Auth + RLS + RPC), Vercel
**Zona waktu:** simpan `timestamptz` UTC, tampil Asia/Jakarta (WIB) di UI.

---

## 1. Keputusan yang dikunci (jangan dibuka lagi saat coding)

1. Serial murni: 1 project = max 1 active session.
2. Session milik PROJECT (anonim). Siapa pun pegang URL QR = sah.
3. Status derived: Not Started / Ongoing / Completed-idle / Archived.
4. Completed = idle, bukan lock. Scan berikutnya = Clock In baru.
5. Archive ganti hard delete. QR archived mati total.
6. Koreksi admin MASUK MVP + audit minimal. Tidak ada auto-close.
7. Single writer: RPC `clock_toggle(qr_token)` atomic. Frontend tidak boleh insert/update langsung.
8. Fraud QR (foto URL, scan dari mana saja) = accepted risk v1.

---

## 2. ERD

```text
auth.users (Supabase Auth)
   │ 1
   │ created_by / admin_id
   ├──────────────────┐
   │                  │
   ▼                  ▼
projects            session_corrections
   │ 1                  ▲
   │ project_id         │ session_id (SET NULL on delete)
   │ RESTRICT           │
   ▼                    │
work_sessions ──────────┘
   │ 1
   │ session_id
   │ CASCADE (corrections ikut terhapus? TIDAK — lihat §4)
   ▼
(session_corrections menyimpan snapshot lama/baru, tetap awet walau session dihapus → pakai SET NULL + kolom project_id denormalized)
```

### 2.1 projects

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| id | uuid PK | default `gen_random_uuid()` | — |
| name | text | NOT NULL, check `length(trim(name)) > 0` | Nama/item project |
| process | `project_process` enum | NOT NULL | `Machining` \| `Assembly` \| `Trial` |
| qr_token | uuid | UNIQUE NOT NULL, default `gen_random_uuid()` | Token QR, bukan id. Diregenerate? TIDAK di v1 (statis). |
| is_archived | boolean | NOT NULL DEFAULT false | Archive ganti delete |
| created_by | uuid → auth.users | nullable (SET NULL on delete admin) | Admin pembuat |
| created_at | timestamptz | NOT NULL DEFAULT now() | UTC |
| updated_at | timestamptz | NOT NULL DEFAULT now() | UTC, via trigger |

Tidak ada kolom `status`. Status di-derive (lihat §6).

### 2.2 work_sessions

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| id | uuid PK | default `gen_random_uuid()` | — |
| project_id | uuid → projects | NOT NULL, ON DELETE RESTRICT | RESTRICT karena tidak ada hard delete project |
| clock_in | timestamptz | NOT NULL DEFAULT now() | UTC |
| clock_out | timestamptz | nullable | NULL = active session |
| duration | interval | GENERATED ALWAYS AS (`clock_out` - `clock_in`) STORED | NULL saat aktif |
| created_at | timestamptz | NOT NULL DEFAULT now() | UTC |
| updated_at | timestamptz | NOT NULL DEFAULT now() | UTC, via trigger |

Constraint wajib:

```sql
-- max 1 active session per project (anti double-tap / 2 HP scan bareng)
CREATE UNIQUE INDEX uniq_active_session
  ON work_sessions (project_id) WHERE clock_out IS NULL;

-- jam valid
ALTER TABLE work_sessions
  ADD CONSTRAINT chk_clock_order CHECK (clock_out IS NULL OR clock_out > clock_in);
```

### 2.3 session_corrections (audit MVP)

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| id | uuid PK | default `gen_random_uuid()` | — |
| session_id | uuid → work_sessions | nullable, ON DELETE SET NULL | Agar log awet walau session dihapus admin |
| project_id | uuid → projects | NOT NULL, ON DELETE RESTRICT | Denormalized agar laporan tetap jalan |
| admin_id | uuid → auth.users | nullable, SET NULL | Siapa koreksi |
| action | text | NOT NULL, CHECK (`UPDATE`/`DELETE`) | Jenis koreksi |
| old_clock_in | timestamptz | nullable | Snapshot |
| new_clock_in | timestamptz | nullable | Snapshot |
| old_clock_out | timestamptz | nullable | Snapshot |
| new_clock_out | timestamptz | nullable | Snapshot |
| reason | text | nullable | Alasan (optional di UI, wajib dianjurkan) |
| created_at | timestamptz | NOT NULL DEFAULT now() | Kapan koreksi |

---

## 3. Status derived (single source of truth)

```sql
-- logika (juga dipakai di view v_project_status):
-- is_archived = true                          → 'Archived'
-- count(sessions) = 0                         → 'Not Started'
-- exists(clock_out IS NULL)                   → 'Ongoing'
-- else                                        → 'Completed' (idle)
```

View disediakan di migration (`v_project_status` + `v_project_totals`). Frontend dilarang menghitung sendiri untuk keputusan IN/OUT — keputusan hanya dari RPC.

---

## 4. RPC `clock_toggle` (single writer, atomic)

**Signature:** `clock_toggle(p_qr_token uuid) RETURNS jsonb`
**Security:** `SECURITY DEFINER`, `GRANT EXECUTE TO anon, authenticated`.
**Frontend tidak boleh** insert/update `work_sessions` langsung (dicabut via RLS).

Flow dalam 1 transaksi:

```text
1. SELECT project ... FOR UPDATE (lock baris project)
   → tidak ketemu → RAISE 'PROJECT_NOT_FOUND'
   → is_archived  → RAISE 'PROJECT_ARCHIVED'
2. SELECT active session WHERE project_id + clock_out IS NULL FOR UPDATE
3a. Tidak ada → INSERT clock_in=now() → RETURN { action: 'IN', ... }
3b. Ada      → UPDATE clock_out=now() → RETURN { action: 'OUT', duration, ... }
   (unique index menjamin tidak ada 2 aktif lolos race)
4. Frontend disable tombol setelah OK + tampilkan hasil RPC (bukan state lokal).
```

Return contoh:

```json
{ "action": "IN", "project_id": "...", "session_id": "...",
  "clock_in": "2026-10-07T01:30:00Z", "clock_out": null,
  "project_status": "Ongoing" }
```

```json
{ "action": "OUT", "project_id": "...", "session_id": "...",
  "clock_in": "2026-10-07T01:30:00Z", "clock_out": "2026-10-07T03:45:00Z",
  "duration_secs": 8100, "project_status": "Completed" }
```

Error codes (kontrak dengan frontend `/scan/[qr_token]`):

| Code | Pesan UI |
|---|---|
| `PROJECT_NOT_FOUND` | QR tidak valid / project tidak ditemukan |
| `PROJECT_ARCHIVED` | Project sudah di-archive, tidak tersedia |
| `CONCURRENT_CONFLICT` (unique violation) | Tombol sudah ditekan / scan ganda — refresh halaman |

---

## 5. RLS ringkas

- `ENABLE ROW LEVEL SECURITY` di semua 3 tabel.
- `projects`: admin (authenticated + claim `is_admin`) full CRUD; `anon` hanya `SELECT` kolom public (`id, project_date, name, process, is_archived`) `WHERE qr_token = ...` — cukup untuk render halaman scan tanpa bocorkan `created_by`.
- `work_sessions`: NO direct insert/update/delete untuk `anon`; `authenticated` admin via policy; public baca riwayat? TIDAK di v1 (halaman scan hanya tampilkan info Clock In terakhir dari return RPC, bukan query bebas).
- `session_corrections`: admin only.
- Klaim admin: pakai `auth.jwt() ->> 'is_admin' = 'true'` ATAU tabel `admins(user_id)` — pilih satu sebelum migration (rekomendasi: tabel `admins` + policy `exists(select 1 from admins where user_id = auth.uid())`, agar tidak utak-atik JWT hook).

---

## 6. Koreksi admin (MVP)

Lokasi: halaman detail project → tabel sessions → tombol Edit / Hapus per baris.

Aturan validasi (di RPC `correct_session` ATAU API route + transaction):

1. `new_clock_out IS NULL OR new_clock_out > new_clock_in`.
2. Tidak boleh overlap dengan session lain project yang sama.
3. Tidak boleh menghasilkan 2 active session (cek `uniq_active_session` + validasi aplikasi).
4. Setiap sukses → insert `session_corrections` + `duration` recalculate otomatis (generated column).
5. Hapus session aktif diperbolehkan (darurat lupa IN salah hari) tapi wajib audit `action='DELETE'`.

---

## 7. Index yang dibutuhkan

```sql
CREATE UNIQUE INDEX ON projects (qr_token);
CREATE INDEX ON work_sessions (project_id, clock_in DESC);
CREATE UNIQUE INDEX uniq_active_session ON work_sessions (project_id) WHERE clock_out IS NULL;
CREATE INDEX ON work_sessions (project_id) WHERE clock_out IS NULL; -- redundant? TIDAK perlu, partial unique sudah cover
CREATE INDEX ON session_corrections (session_id);
CREATE INDEX ON session_corrections (project_id, created_at DESC);
```

---

## 8. Next step ke kode

1. Jalankan `supabase/migrations/0001_init.sql` (file sebelah).
2. Buat tabel `admins(user_id uuid pk)` + 1 baris admin pertama manual, ATAU set JWT claim — pilih satu.
3. Next.js routes: `/login`, `/admin/*`, `/scan/[qr_token]` (mobile-first, tombol besar, confirm dialog, disable-after-OK, tampilkan Clock In terakhir sebagai fraud deterrent).
4. Jangan hitung duration di client. Format WIB hanya untuk display: `Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', ... })`.
