# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## Project Tracking & QR Clock In/Out System

**Version:** 1.3  
**Status:** Revised (08 Oct 2026)  
**Changelog v1.3:** Halaman Rekap Record global (/admin/records: search + filter + pagination + Export CSV mengikuti filter). Halaman scanner publik (/scan: kamera dalam website + tempel manual, auto-kembali setelah sukses). Halaman scan tampilkan info Clock In terakhir sebagai anti-fraud.
**Changelog v1.2:** Tanggal dihapus dari project — create cukup nama + process. Tiap record session membawa tanggal/waktunya sendiri. Dashboard menampilkan rekap record terbaru lintas project.
**Changelog v1.1:** (1) Status model dikunci: Not Started / Ongoing / Completed (idle) / Archived. (2) Admin koreksi session naik ke MVP. (3) Concurrency serial + anonim: session milik project. (4) Integritas via RPC atomic + partial unique index + UTC. (5) Delete = Archive saja. (6) QR fraud diterima sebagai risiko v1.  
**Platform:** Web Application  
**Frontend:** Next.js + TypeScript  
**Database & Backend Services:** Supabase  
**Deployment:** Vercel  

---

# 1. Overview

## 1.1 Background

Project Tracking & QR Clock In/Out System merupakan aplikasi berbasis web yang digunakan untuk mencatat dan memantau aktivitas pengerjaan suatu project secara terstruktur.

Sistem memungkinkan admin untuk membuat dan mengelola data project. Setiap project yang dibuat akan memiliki QR Code unik yang dapat digunakan sebagai media pencatatan waktu pengerjaan.

Operator atau pengguna di lapangan dapat melakukan **Clock In** dan **Clock Out** dengan melakukan scan QR Code menggunakan perangkat mobile. Sistem akan secara otomatis menentukan apakah scan tersebut merupakan Clock In atau Clock Out berdasarkan status session project saat itu.

Satu project dapat memiliki banyak siklus Clock In dan Clock Out. Dengan demikian, seluruh riwayat waktu pengerjaan project dapat tersimpan dan digunakan untuk menghitung total durasi pengerjaan.

---

# 2. Problem Statement

Pencatatan waktu pengerjaan project secara manual memiliki beberapa permasalahan:

1. Waktu mulai dan selesai pengerjaan sulit dicatat secara konsisten.
2. Riwayat pengerjaan suatu project tidak terdokumentasi secara terstruktur.
3. Project dapat dikerjakan dalam beberapa sesi sehingga pencatatan menggunakan satu pasangan jam masuk dan jam keluar tidak mencukupi.
4. Proses pencatatan manual berpotensi menyebabkan kesalahan input.
5. Admin membutuhkan cara yang lebih mudah untuk melihat status project dan total waktu pengerjaannya.
6. Pencatatan menggunakan perangkat mobile perlu dibuat sederhana agar dapat digunakan dengan cepat di area kerja.

---

# 3. Product Goals

Sistem dikembangkan dengan tujuan:

1. Menyediakan sistem pencatatan waktu pengerjaan project secara digital.
2. Menggunakan QR Code sebagai identitas unik setiap project.
3. Memungkinkan Clock In dan Clock Out dengan proses scan QR yang sederhana.
4. Menyimpan seluruh riwayat session pengerjaan project.
5. Menghitung durasi pengerjaan secara otomatis.
6. Menyediakan dashboard admin untuk memantau project.
7. Mengurangi kesalahan pencatatan waktu secara manual.
8. Menyediakan sistem yang responsif dan nyaman digunakan melalui smartphone.
9. Menggunakan arsitektur serverless dengan Next.js, Supabase, dan Vercel.

---

# 4. Scope

## 4.1 In Scope

Fitur yang termasuk dalam versi awal sistem:

- Admin authentication.
- Dashboard admin.
- Create project.
- Edit project.
- Archive project (nonaktif, QR mati, data awet). Tidak ada hard delete di v1.
- Project listing.
- Project detail.
- Project status (Not Started / Ongoing / Completed / Archived — lihat Section 14).
- Generate QR Code otomatis.
- Menampilkan QR Code project.
- Download QR Code.
- Public QR scanning (anonim, tanpa login — lihat Section 5.2).
- Clock In.
- Clock Out.
- Confirmation sebelum Clock In/Out.
- Multiple Clock In/Out pada project yang sama (serial, max 1 active session).
- Clock toggle atomic via Supabase RPC + transaction (anti double-tap / double-scan).
- Perhitungan durasi session di DB (generated column, sumber UTC).
- Perhitungan total durasi project.
- Riwayat session project.
- Admin koreksi session: edit jam Clock In/Out + hapus session salah + recalculate otomatis + audit log minimal.
- Responsive mobile interface.
- Database menggunakan Supabase PostgreSQL (timestamptz UTC).
- Authentication menggunakan Supabase Auth.
- Deployment menggunakan Vercel.

## 4.2 Out of Scope

Fitur berikut belum menjadi bagian dari versi awal:

- Payroll.
- Perhitungan gaji.
- Absensi pegawai secara umum.
- Identitas operator / login operator (tetap anonim di v1 — lihat Section 5.2).
- GPS/geolocation (risiko fraud QR diterima di v1 — lihat Section 20).
- Face recognition.
- Fingerprint.
- PIN lokasi.
- Integrasi mesin produksi.
- Integrasi ERP.
- Notifikasi WhatsApp.
- Mobile application native Android/iOS.
- Hard delete project (diganti Archive — lihat Section 14).

---

# 5. User Roles

## 5.1 Admin

Admin merupakan pengguna yang memiliki akses terhadap sistem management.

Hak akses utama:

- Login.
- Melihat dashboard.
- Membuat project.
- Melihat project.
- Mengubah project.
- Archive / unarchive project (tidak ada hard delete di v1).
- Melihat QR Code.
- Download QR Code.
- Melihat riwayat Clock In/Out.
- Melihat durasi project.
- Mengoreksi session: edit jam Clock In/Out, hapus session salah (wajib recalculate + audit log minimal: siapa, kapan, nilai lama/baru).

## 5.2 Public User / Operator

Public user merupakan pengguna yang melakukan aktivitas Clock In dan Clock Out.

Public user:

- Tidak perlu login.
- Mengakses halaman melalui QR Code.
- Melihat informasi project + info Clock In terakhir / durasi berjalan (sebagai deterrent fraud).
- Melakukan konfirmasi Clock In.
- Melakukan konfirmasi Clock Out.

> LOCKED v1.1 (hasil grilling): identitas operator TIDAK dicatat. Session adalah milik PROJECT, bukan milik orang. Siapa pun yang memegang URL QR dianggap operator sah. Konsekuensi: jika shift pagi Clock In oleh Andi lalu siang Budi scan, scan Budi dibaca sebagai Clock OUT milik session Andi. Ini accepted untuk v1. Tracking per-operator masuk Future (Section 27).

---

# 6. Functional Requirements

## FR-01 — Admin Authentication

Sistem harus menyediakan halaman login khusus admin.

Admin melakukan login menggunakan:

- Email
- Password

Setelah berhasil login, admin diarahkan ke Dashboard.

Admin yang belum login tidak dapat mengakses halaman management.

---

## FR-02 — Project Management

Admin dapat membuat project baru.

Data minimum project (v1.2 — tanpa tanggal):

| Field | Required | Keterangan |
|---|---|---|
| Nama Project | Ya | Nama/item project |
| Process | Ya | Machining, Assembly, atau Trial |

Tanggal dan jam kerja tidak disimpan di project, melainkan di tiap record session (`clock_in` / `clock_out`). Satu project dapat dikerjakan berhari-hari.

Setelah project berhasil dibuat, sistem secara otomatis menghasilkan QR Code unik untuk project tersebut.

---

## FR-03 — Project Process

Sistem menyediakan pilihan process:

- Machining
- Assembly
- Trial

Process disimpan sebagai bagian dari informasi project.

Untuk versi awal, satu project memiliki satu process.

---

## FR-04 — QR Code Generation

Setiap project harus memiliki QR Code unik.

QR Code berisi URL/token yang mengarah ke halaman public project.

Contoh:

```text
https://domain.com/scan/{qr-token}
```

QR Code tidak menyimpan informasi sensitif secara langsung.

Sistem menggunakan token unik sebagai identifier project.

QR Code dapat:

- Ditampilkan oleh admin.
- Dibuka dalam tampilan yang dapat dicetak.
- Di-download sebagai gambar.

QR Code tetap terhubung dengan project selama project tersebut masih aktif.

---

# 7. Public QR Scanning

## FR-05 — Scan QR

Pengguna melakukan scan QR Code menggunakan kamera smartphone.

QR Code mengarahkan pengguna ke halaman public:

```text
/scan/{qr-token}
```

Sistem mengambil data project berdasarkan QR token.

Halaman harus responsive dan mobile-first.

---

# 8. Clock In Logic

Ketika QR Code discan, sistem akan memeriksa apakah project memiliki session aktif.

Session aktif didefinisikan sebagai:

```text
clock_in IS NOT NULL
AND
clock_out IS NULL
```

### Jika tidak terdapat session aktif:

Sistem menganggap scan sebagai **Clock In**.

Contoh tampilan:

```text
CLOCK IN

Project
Project A

Process
Machining

[ CLOCK IN ]
```

Ketika tombol ditekan, sistem menampilkan confirmation:

```text
Apakah Anda yakin ingin
Clock In project ini?

[ BATAL ] [ OK ]
```

Clock In hanya disimpan setelah pengguna menekan `OK`.

---

# 9. Clock Out Logic

Jika project memiliki session aktif, maka scan QR berikutnya dianggap sebagai **Clock Out**.

Contoh:

```text
CLOCK OUT

Project
Project A

Process
Machining

Clock In
08:30

[ CLOCK OUT ]
```

Sistem menampilkan confirmation:

```text
Apakah Anda yakin ingin
Clock Out project ini?

[ BATAL ] [ OK ]
```

Setelah pengguna menekan `OK`, sistem mencatat waktu Clock Out.

---

# 10. Multiple Clock In / Clock Out

Satu project dapat memiliki banyak session.

Contoh:

```text
Project A

Session 1
08:00 → 10:00

Session 2
13:00 → 15:00

Session 3
16:00 → 17:30
```

Flow sistem:

```text
Scan
 ↓
Tidak ada session aktif
 ↓
CLOCK IN
 ↓
Scan lagi
 ↓
Ada session aktif
 ↓
CLOCK OUT
 ↓
Scan lagi
 ↓
Tidak ada session aktif
 ↓
CLOCK IN
 ↓
...
```

Dengan demikian, status project secara otomatis berubah berdasarkan session terakhir.

---

# 11. Work Session

Setiap pasangan Clock In dan Clock Out disimpan sebagai satu session.

Contoh:

```text
Session #1

Clock In  : 08:30
Clock Out : 10:45
Duration  : 02:15
```

Jika project belum melakukan Clock Out:

```text
Session #2

Clock In  : 13:00
Clock Out : NULL
Duration  : NULL
```

Session tersebut dianggap sebagai active session.

---

# 12. Duration Calculation

> LOCKED v1.1: simpan UTC, tampil WIB. `duration` dihitung DB sebagai `clock_out - clock_in` (generated column). Active session: `duration = NULL`.

Durasi session dihitung dari:

```text
Duration = Clock Out (UTC) - Clock In (UTC), display Asia/Jakarta
```

Contoh:

```text
Clock In  : 08:15 WIB
Clock Out : 10:45 WIB

Duration  : 2 jam 30 menit
```

Total durasi project merupakan penjumlahan seluruh session yang telah selesai (`clock_out IS NOT NULL`). Session aktif tidak ikut total.

Contoh:

```text
Session 1 = 2 jam
Session 2 = 1 jam 30 menit
Session 3 = 3 jam

Total = 6 jam 30 menit
```

---

# 13. Dashboard

Admin memiliki dashboard untuk melihat kondisi project secara keseluruhan.

Informasi utama yang ditampilkan:

- Total Project (excl. Archived, dengan toggle tampilkan Archived).
- Project Ongoing (ada active session, excl. Archived).
- Project Completed / Idle (tidak ada active session tapi ≥1 session, excl. Archived).
- Total Working Duration (sum duration selesai, excl. Archived kecuali diminta).

Dashboard juga menyediakan rekap record terbaru lintas project (bukan daftar project).

Contoh:

| Tanggal | Project | Clock In | Clock Out | Duration |
|---|---|---|---:|---:|
| 07/10/2026 | Project A | 08:00 | 10:00 | 02:00 |
| 07/10/2026 | Project B | 09:15 | — (aktif) | — |
| 06/10/2026 | Project C | 13:00 | 15:30 | 02:30 |

---

# 14. Project Status

> LOCKED v1.1: status adalah DERIVED dari session + flag archive, bukan field manual yang diedit bebas. Source of truth = `work_sessions` + `projects.is_archived`. Kolom `projects.status` (jika ada) hanya cache/display yang di-update via trigger/RPC.

Status final v1:

### Not Started

Project belum memiliki session sama sekali.

```text
COUNT(sessions) = 0 AND is_archived = false
```

### Ongoing

Project memiliki tepat 1 session aktif.

```text
EXISTS(session WHERE clock_in IS NOT NULL AND clock_out IS NULL)
AND is_archived = false
```

### Completed (idle)

Tidak ada session aktif, tapi sudah pernah ada ≥1 session selesai. Ini BUKAN lock final — scan berikutnya akan membuka Clock In baru dan status kembali Ongoing (flip-flop by design).

```text
COUNT(sessions) > 0
AND NO active session
AND is_archived = false
```

### Archived

Di-archive oleh admin. QR mati total, scan ditolak (lihat Section 19). Data sessions tetap awet untuk laporan.

```text
is_archived = true (mengalahkan semua status lain)
```

Aturan:
- Unarchive mengembalikan status ke derived (Not Started / Ongoing / Completed).
- Dashboard Ongoing vs Completed adalah snapshot sesaat, bukan progres linear.

---

# 15. Project Detail

Admin dapat membuka detail sebuah project.

Halaman detail menampilkan:

```text
Project A
Machining
07 October 2026

Status
ONGOING

Total Duration
06h 32m
```

Kemudian menampilkan history session:

| # | Clock In | Clock Out | Duration |
|---:|---|---|---:|
| 1 | 08:00 | 10:00 | 02:00 |
| 2 | 13:00 | 15:30 | 02:30 |
| 3 | 16:00 | 18:02 | 02:02 |

## 15b. Admin Koreksi Session (MVP — hasil grilling)

Menangani kasus lupa Clock Out / jam salah input:

- Admin dapat edit `clock_in` / `clock_out` per session (datetime picker, zona WIB, simpan UTC).
- Admin dapat hapus session salah.
- Validasi: `clock_out > clock_in`, tidak boleh membuat overlap antar session, tidak boleh membuat 2 active session.
- Setiap koreksi wajib recalculate `duration` + `total duration` otomatis.
- Audit log minimal (tabel `session_corrections` atau kolom audit): siapa admin, kapan, session apa, nilai lama → baru.
- Session aktif yang lupa di-clock-out berhari-hari TIDAK di-auto-close oleh sistem; dibiarkan menggantung sampai di-clock-out via scan atau dikoreksi admin. Ini disengaja agar tidak ada data fiktif.

---

# 16. Project History

Setiap project memiliki riwayat aktivitas.

Riwayat minimal mencatat:

- Clock In.
- Clock Out.
- Waktu aktivitas.
- Durasi session.

Contoh:

```text
07 October 2026

08:00
CLOCK IN

10:00
CLOCK OUT
Duration: 2h

13:00
CLOCK IN

15:30
CLOCK OUT
Duration: 2h 30m
```

---

# 17. Project Management Page

Admin dapat melihat seluruh project dalam bentuk tabel.

Fitur yang direncanakan:

- Search project.
- Filter tanggal.
- Filter process.
- Filter status (Not Started / Ongoing / Completed / Archived).
- Toggle tampilkan / sembunyikan Archived (default sembunyi).
- View detail.
- View QR.
- Edit project.
- Archive / unarchive project (ganti hard delete).

Contoh (v1.2 — tanpa kolom tanggal project):

| Project | Process | Status | Action |
|---|---|---|---|
| Project A | Machining | Ongoing | Detail |
| Project B | Assembly | Completed | Detail |
| Project C | Trial | Not Started | Detail |

---

# 18. Responsive Design

Sistem harus responsive pada:

- Desktop.
- Tablet.
- Smartphone.

Halaman public QR scanner menggunakan pendekatan **mobile-first**.

Prioritas desain mobile:

1. Informasi project jelas.
2. Status Clock In/Out terlihat jelas.
3. Tombol besar dan mudah ditekan.
4. Confirmation mudah dipahami.
5. Tidak membutuhkan navigasi yang kompleks.

Contoh struktur mobile:

```text
┌───────────────────────┐
│   PROJECT TRACKER     │
│                       │
│     PROJECT A         │
│      MACHINING        │
│                       │
│     ● READY            │
│                       │
│   ┌───────────────┐   │
│   │   CLOCK IN    │   │
│   └───────────────┘   │
│                       │
└───────────────────────┘
```

---

# 19. Error Handling

Sistem harus menangani kondisi berikut.

## Invalid QR

Jika QR Code tidak ditemukan:

```text
QR Code tidak valid atau
project tidak ditemukan.
```

## Archived / Inactive Project

Jika project di-archive (lihat Section 14):

```text
Project ini sudah tidak tersedia
untuk pencatatan (Archived).
```

Scan ke project Archived selalu ditolak di level RPC, walau ada session aktif menggantung.

## Clock Out Tanpa Clock In

Kondisi ini tidak boleh terjadi melalui flow normal.

Sistem harus melakukan validasi pada server.

## Double Clock In / Double Scan

Sistem harus mencegah dua session aktif pada project yang sama, termasuk kasus double-tap tombol OK dan 2 HP scan bersamaan.

Aturan LOCKED v1.1:
- Single entry point: fungsi RPC `clock_toggle(qr_token)` dengan transaction + row lock.
- `partial unique index ON work_sessions(project_id) WHERE clock_out IS NULL`.
- Jika sudah terdapat active session, scan berikutnya WAJIB diarahkan menjadi Clock Out (bukan error, bukan session baru).
- Frontend wajib disable tombol setelah OK ditekan + idempotency guard.

---

# 20. Security Requirements

## Authentication

Admin menggunakan Supabase Authentication.

## Authorization

Akses management hanya diberikan kepada user yang memiliki role admin.

## QR Security

QR Code menggunakan unique token (UUID v4) dan bukan ID database yang mudah ditebak.

Contoh:

```text
/scan/550e8400-e29b-41d4-a716-446655440000
```

bukan:

```text
/scan/1
```

> LOCKED v1.1 — Accepted risk (hasil grilling): QR statis, tanpa GPS, tanpa login operator. Siapa pun memegang URL/foto QR dapat Clock In/Out dari mana saja. Ini diterima untuk v1 dengan mitigasi minimal: halaman scan menampilkan info Clock In terakhir + durasi berjalan agar kecurangan mudah terlihat. GPS / PIN lokasi / auth operator masuk Future (Section 27).

## Server-side Validation

Keputusan Clock In atau Clock Out harus divalidasi di server/database via RPC atomic.

Frontend tidak boleh menentukan status hanya berdasarkan state lokal.

Flow LOCKED v1.1:

```text
Client
  ↓
Request (qr_token)
  ↓
RPC clock_toggle(qr_token) — single transaction
  ↓
1. Lock project row + tolak jika is_archived
2. Cari active session (FOR UPDATE)
3. Jika tidak ada → INSERT clock_in = now()
   Jika ada → UPDATE clock_out = now() + hitung duration
  ↓
Return IN / OUT + session + duration
```

Aturan waktu: simpan `timestamptz` UTC di DB, tampilkan WIB (Asia/Jakarta) di UI. `duration` = generated column `clock_out - clock_in`, bukan hitung manual di client.

---

# 21. Database Overview

> LOCKED v1.1: aturan integritas level DB (hasil grilling). Wajib diimplementasikan di migration, bukan hanya di aplikasi.

Struktur database awal terdiri dari:

```text
users / auth.users
       │
       │ created_by
       ▼
   projects
       │
       │ project_id
       ▼
 work_sessions ──→ session_corrections (audit koreksi admin)
```

## Projects

Menyimpan informasi utama project.

Field utama:

```text
id (uuid, pk)
project_date (date)
name (text)
process (enum: Machining | Assembly | Trial)
qr_token (uuid, unique, not null, default gen_random_uuid())
is_archived (boolean, default false) — ganti hard delete
created_by (uuid → auth.users)
created_at (timestamptz, UTC)
updated_at (timestamptz, UTC)
```

Catatan: `status` TIDAK disimpan sebagai sumber kebenaran; status di-derive (Section 14). Jika perlu kolom display, update hanya via trigger/RPC.

RLS: public read project by `qr_token` hanya untuk halaman scan (kolom terbatas); write hanya via RPC `clock_toggle`. Full CRUD hanya admin.

## Work Sessions

Menyimpan seluruh aktivitas Clock In/Out.

Field utama:

```text
id (uuid, pk)
project_id (uuid → projects, ON DELETE RESTRICT — karena tidak ada hard delete)
clock_in (timestamptz UTC, not null)
clock_out (timestamptz UTC, nullable)
duration (interval, GENERATED ALWAYS AS (clock_out - clock_in) STORED)
created_at (timestamptz, UTC)
updated_at (timestamptz, UTC)
```

Constraint wajib:

```sql
-- max 1 active session per project
CREATE UNIQUE INDEX uniq_active_session
ON work_sessions(project_id) WHERE clock_out IS NULL;

-- validasi waktu (check constraint)
CHECK (clock_out IS NULL OR clock_out > clock_in);
```

## Session Corrections (audit, MVP)

```text
id, session_id → work_sessions, admin_id → auth.users,
old_clock_in, new_clock_in, old_clock_out, new_clock_out,
reason (text, optional), created_at
```

Relasi:

```text
Project 1 ─────── N Work Sessions
```

Satu project dapat memiliki banyak work session, tetapi max 1 yang aktif.

---

# 22. Technology Architecture

## Frontend

```text
Next.js
TypeScript
Tailwind CSS
```

Next.js digunakan sebagai framework utama untuk:

- UI.
- Routing.
- Server-side logic.
- API/Server Actions.
- Admin dashboard.
- Public scanning page.

## Backend

Supabase digunakan untuk:

- PostgreSQL Database.
- Authentication.
- Row Level Security.
- Backend services.

## Deployment

Aplikasi di-deploy menggunakan:

```text
Vercel
```

Database:

```text
Supabase
```

Arsitektur:

```text
                    User
                     │
            ┌────────┴────────┐
            │                 │
         Admin              Operator
            │                 │
            ▼                 ▼
       Next.js App       QR Scan Page
            │                 │
            └────────┬────────┘
                     │
                  Supabase
                     │
          ┌──────────┼──────────┐
          │          │          │
       Auth       Database     RLS
                     │
             ┌───────┴───────┐
             │               │
          Projects       Sessions
```

---

# 23. User Flow

## Admin Flow

```text
Login
  ↓
Dashboard
  ↓
Projects
  ↓
Create Project
  ↓
Input:
- Nama Project
- Process
  ↓
Create
  ↓
Generate QR
  ↓
Project Created
```

---

## Operator Flow — Clock In

```text
Scan QR
  ↓
Project ditemukan
  ↓
System check:
Active session?
  ↓
NO
  ↓
Display CLOCK IN
  ↓
User click CLOCK IN
  ↓
Confirmation
  ↓
OK
  ↓
Create Work Session
  ↓
Clock In Success
```

---

## Operator Flow — Clock Out

```text
Scan QR
  ↓
Project ditemukan
  ↓
System check:
Active session?
  ↓
YES
  ↓
Display CLOCK OUT
  ↓
User click CLOCK OUT
  ↓
Confirmation
  ↓
OK
  ↓
Update Active Session
  ↓
Calculate Duration
  ↓
Clock Out Success
```

---

# 24. Non-Functional Requirements

## Performance

Halaman public scanner harus dapat dibuka dengan cepat pada perangkat mobile.

Database query harus dibuat efisien sehingga proses validasi session tidak membutuhkan query yang tidak diperlukan.

## Availability

Sistem dirancang dengan layanan cloud:

- Vercel.
- Supabase.

Tidak membutuhkan server aplikasi yang dikelola secara manual.

## Usability

Proses Clock In/Out harus dapat dilakukan dalam beberapa langkah sederhana:

```text
Scan → Review → Confirm → Done
```

## Responsive

UI harus dapat digunakan dengan baik pada layar:

- Mobile.
- Tablet.
- Desktop.

## Maintainability

Codebase menggunakan:

- TypeScript.
- Modular components.
- Separation of admin/public features.
- Database schema terstruktur.

---

# 25. Suggested Route Structure

```text
/
├── login
│
├── admin
│   ├── dashboard        (rekap record terbaru)
│   ├── projects
│   │   ├── page         (list + filter)
│   │   ├── create
│   │   └── [id]         (detail + QR + koreksi)
│   ├── records          (semua record + search + pagination)
│   │   └── export       (CSV mengikuti filter, admin only)
│   └── profile
│
└── scan
    ├── page             (scanner kamera + tempel manual, publik)
    └── [qr_token]       (clock in/out, publik)
```

---

# 26. MVP Definition

Versi MVP (v1.1 locked) dianggap berhasil apabila sistem telah mampu:

### Admin

- [x] Login.
- [x] Create project (nama + process saja).
- [x] Menentukan nama project.
- [x] Menentukan process (satu project = satu process).
- [x] Generate QR Code.
- [x] Melihat daftar project + filter status (termasuk Archived).
- [x] Melihat detail project.
- [x] Melihat history session.
- [x] Archive / unarchive project (pengganti delete).
- [x] Koreksi session: edit jam + hapus session + audit log minimal.
- [x] Rekap semua record lintas project + search + pagination.
- [x] Export CSV mengikuti filter (maks 10.000 baris, anti formula-injection).

### Public

- [x] Scan/access QR (kamera HP maupun scanner di website).
- [x] Halaman scanner publik + tempel token manual.
- [x] Menampilkan project + info Clock In terakhir (anti-fraud).
- [x] Menentukan otomatis Clock In/Out via RPC.
- [x] Confirmation Clock In.
- [x] Confirmation Clock Out.
- [x] Multiple Clock In/Out serial.
- [x] Menolak scan ke project Archived.
- [x] Menghitung durasi (UTC simpan, WIB tampil).

### Technical

- [x] Next.js.
- [x] TypeScript.
- [x] Supabase.
- [x] Supabase Auth + RLS.
- [x] PostgreSQL + RPC `clock_toggle` + partial unique index.
- [x] Responsive UI.
- [x] Vercel deployment.

---

# 27. Future Development

Fitur berikut dapat dikembangkan pada versi berikutnya (admin koreksi SUDAH masuk MVP v1.1, tidak lagi di sini):

1. Operator authentication.
2. Data employee/operator.
3. Tracking operator pada setiap session (session milik orang, dukung paralel).
4. GPS validation / PIN lokasi (atasi fraud QR).
5. Device information.
6. Auto-close session menggantung (aturan lembur / ganti hari).
7. Export Excel (CSV sudah masuk MVP v1.3).
8. Reporting harian/mingguan/bulanan.
9. Dashboard analytics.
10. Grafik total working hours.
11. Multiple process dalam satu project.
12. Notification.
13. PWA.
14. Audit log penuh (saat ini minimal untuk koreksi saja).
15. Role-based access control.

---

# 28. Success Metrics

Sistem dianggap berhasil apabila:

1. Admin dapat membuat project dan mendapatkan QR Code secara otomatis.
2. Operator dapat melakukan Clock In melalui QR dalam proses yang sederhana.
3. Operator dapat melakukan Clock Out menggunakan QR yang sama.
4. Sistem tidak mengizinkan dua active session pada project yang sama.
5. Satu project dapat memiliki banyak session.
6. Durasi setiap session dapat dihitung otomatis.
7. Total durasi project dapat dihitung dengan benar.
8. Seluruh riwayat pengerjaan dapat dilihat oleh admin.
9. Sistem dapat digunakan dengan nyaman melalui smartphone.
10. Data Clock In/Out tersimpan secara konsisten di Supabase.

---

# 29. Open Decisions — LOCKED v1.1 (hasil grilling 07 Oct 2026)

Semua keputusan di bawah SUDAH dikunci dan tercermin di PRD. Jangan dibuka lagi saat ERD kecuali ada alasan bisnis baru:

1. ~~Satu project satu atau beberapa process?~~ → LOCKED: satu project = satu process (Machining | Assembly | Trial).
2. ~~Operator perlu identitas/account?~~ → LOCKED: tidak. Anonim, session milik project.
3. ~~Satu project dikerjakan paralel?~~ → LOCKED: tidak. Serial, max 1 active session (partial unique index + RPC).
4. ~~Mekanisme Completed?~~ → LOCKED: otomatis/derived. Completed = idle (tidak ada active session tapi ≥1 session). Scan berikutnya = Clock In baru.
5. ~~Admin koreksi Clock In/Out?~~ → LOCKED: ya, masuk MVP + audit minimal. Tidak ada auto-close; session menggantung dibiarkan sampai scan/koreksi.
6. ~~Hapus atau archive?~~ → LOCKED: archive saja. Tidak ada hard delete. QR archived mati total.
7. Export laporan? → Future (v2).
8. GPS/geolocation? → Future. Risiko fraud diterima di v1.
9. Audit log? → Minimal untuk koreksi masuk MVP; full audit = Future.
10. PWA? → Future.

# 30. Summary

Project Tracking & QR Clock In/Out System merupakan aplikasi web berbasis Next.js dan Supabase yang memungkinkan admin mengelola project serta menghasilkan QR Code unik untuk setiap project.

QR Code digunakan oleh operator anonim melalui perangkat mobile untuk melakukan Clock In dan Clock Out. Sistem menentukan jenis aktivitas berdasarkan keberadaan active work session via RPC atomic `clock_toggle`: jika tidak terdapat session aktif, scan menjadi Clock In; jika ada, menjadi Clock Out. Satu project serial (max 1 active session) dan dapat memiliki banyak session sepanjang hidupnya.

Status di-derive (Not Started / Ongoing / Completed-idle / Archived). Completed bukan lock final; Archived mematikan QR. Duration dihitung DB dari timestamp UTC dan ditampilkan WIB. Admin dapat mengoreksi session yang salah dengan audit minimal. Arsitektur: Next.js + Supabase (Auth/RLS/PostgreSQL) + Vercel, mobile-first, server-side validation.