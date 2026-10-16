import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import {
  fmtDateWIB,
  fmtTimeWIB,
  fmtDateTimeWIB,
  fmtDuration,
} from "@/lib/format";
import type { Project, WorkSession } from "@/lib/types";
import {
  Chip,
  EmptyRow,
  Field,
  StatusBadge,
  Window,
  inputCls,
} from "@/components/ui";
import { Pager } from "@/components/pager";
import { SubmitButton } from "@/components/submit-button";
import { DeleteProjectButton } from "@/components/delete-project-button";
import {
  updateProject,
  setArchived,
  removeSession,
} from "@/app/admin/projects/actions";
import { CorrectionForm } from "@/components/correction-form";

// Halaman dinamis per request (data sesi login) → navigasi boleh blocking.
export const instant = false;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Correction {
  id: string;
  action: string;
  old_clock_in: string | null;
  new_clock_in: string | null;
  old_clock_out: string | null;
  new_clock_out: string | null;
  reason: string | null;
  created_at: string;
}

const BTN =
  "press min-h-11 cursor-pointer rounded border-2 border-ink px-5 py-2.5 font-mono text-sm font-bold tracking-wider uppercase shadow-brutal-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

function sessionSecs(s: WorkSession): number | null {
  if (!s.clock_out) return null;
  return Math.max(
    0,
    Math.round(
      (new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()) / 1000,
    ),
  );
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ spage?: string; apage?: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const sq = (await searchParams) ?? {};
  const spage = Math.max(1, parseInt(sq.spage ?? "1", 10) || 1);
  const apage = Math.max(1, parseInt(sq.apage ?? "1", 10) || 1);
  const PER_SESSION = 15;
  const PER_AUDIT = 10;

  // Wajib request-time: halaman memakai data sesi + DB per request.
  await connection();
  const projectRes = await db.query<Project>(
    "select id, name, process, qr_token, is_archived, created_at, updated_at from public.projects where id = $1",
    [id],
  );
  const project = projectRes.rows[0] ?? null;
  if (!project) notFound();
  const p = project;

  const sessionsRes = await db.query<WorkSession>(
    `select id, project_id, clock_in, clock_out, clock_in_by, clock_out_by
     from public.work_sessions where project_id = $1
     order by clock_in desc limit $2 offset $3`,
    [id, PER_SESSION, (spage - 1) * PER_SESSION],
  );
  const sessions = sessionsRes.rows;
  const countRes = await db.query<{ n: string }>(
    "select count(*)::text as n from public.work_sessions where project_id = $1",
    [id],
  );
  const sessionTotal = Number(countRes.rows[0]?.n ?? 0);

  const correctionsRes = await db.query<{
    id: string;
    action: string;
    old_clock_in: string | null;
    new_clock_in: string | null;
    old_clock_out: string | null;
    new_clock_out: string | null;
    reason: string | null;
    created_at: string;
  }>(
    `select id, action, old_clock_in, new_clock_in, old_clock_out, new_clock_out, reason, created_at
     from public.session_corrections where project_id = $1
     order by created_at desc limit $2 offset $3`,
    [id, PER_AUDIT, (apage - 1) * PER_AUDIT],
  );
  const corrections = correctionsRes.rows;
  const auditCountRes = await db.query<{ n: string }>(
    "select count(*)::text as n from public.session_corrections where project_id = $1",
    [id],
  );
  const auditTotal = Number(auditCountRes.rows[0]?.n ?? 0);

  const sessionPages = Math.max(1, Math.ceil((sessionTotal ?? 0) / PER_SESSION));
  const auditPages = Math.max(1, Math.ceil((auditTotal ?? 0) / PER_AUDIT));
  if (spage > sessionPages || apage > auditPages) {
    const sp = new URLSearchParams();
    if (Math.min(spage, sessionPages) > 1)
      sp.set("spage", String(Math.min(spage, sessionPages)));
    if (Math.min(apage, auditPages) > 1)
      sp.set("apage", String(Math.min(apage, auditPages)));
    const q = sp.toString();
    redirect(`/admin/projects/${id}${q ? `?${q}` : ""}`);
  }

  // Agregat global (tidak ikut pagination) untuk kartu + status.
  const statusRes = await db.query<{ status: string; session_count: number }>(
    "select status, session_count from public.v_project_status where project_id = $1",
    [id],
  );
  const statusRow = statusRes.rows[0] ?? null;
  const totalRes = await db.query<{ total_secs: string }>(
    "select total_secs from public.v_project_totals where project_id = $1",
    [id],
  );
  const totalRow = totalRes.rows[0] ?? null;
  const activeRes = await db.query<{ clock_in: string }>(
    "select clock_in from public.work_sessions where project_id = $1 and clock_out is null limit 1",
    [id],
  );
  const activeRow = activeRes.rows[0] ?? null;

  const list = sessions;
  const sessionCount = statusRow?.session_count ?? sessionTotal;
  const totalSecs = Number(totalRow?.total_secs ?? 0);
  const activeClockIn = activeRow?.clock_in;
  const status = p.is_archived ? "Archived" : (statusRow?.status ?? "Not Started");

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  const scanUrl = `${siteUrl}/scan/${p.qr_token}`;
  const qrDataUrl = await QRCode.toDataURL(scanUrl, {
    width: 512,
    margin: 2,
  });

  return (
    <div>
      <Link
        href="/admin/projects"
        className="mark-link rounded font-mono text-sm font-bold tracking-wider uppercase"
      >
        ← Kembali
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl font-bold uppercase">
            {p.name}
          </h1>
          <p className="mt-1">
            <Chip tint="bg-sky/40">{p.process}</Chip>
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="border-2 border-ink bg-paper shadow-brutal-sm">
          <p className="border-b-2 border-ink bg-peach px-2 py-1 font-mono text-[11px] font-bold tracking-widest uppercase">
            Total
          </p>
          <p className="px-2 py-2 font-display text-xl font-bold text-bubblegumink tabular-nums md:text-2xl">
            {fmtDuration(totalSecs)}
          </p>
        </div>
        <div className="border-2 border-ink bg-paper shadow-brutal-sm">
          <p className="border-b-2 border-ink bg-lavender px-2 py-1 font-mono text-[11px] font-bold tracking-widest uppercase">
            Record
          </p>
          <p className="px-2 py-2 font-display text-xl font-bold tabular-nums md:text-2xl">
            {sessionCount}×
          </p>
        </div>
        <div className="border-2 border-ink bg-paper shadow-brutal-sm">
          <p className="border-b-2 border-ink bg-mint px-2 py-1 font-mono text-[11px] font-bold tracking-widest uppercase">
            Aktif
          </p>
          <p className="px-2 py-2 font-display text-xl font-bold tabular-nums md:text-2xl">
            {activeClockIn ? fmtTimeWIB(activeClockIn) : "—"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Window title="QR_Project.Exe" bar="bg-butter">
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt={`QR Code untuk ${p.name}`}
              width={224}
              height={224}
              className="mx-auto h-56 w-56 border-2 border-ink bg-paper shadow-brutal-sm"
            />
          <p className="mt-3 font-mono text-xs break-all text-inksoft">
            {scanUrl}
          </p>
          {siteUrl.includes("localhost") &&
            process.env.NODE_ENV === "production" && (
              <p
                role="alert"
                className="mx-auto mt-2 max-w-xs rounded border-2 border-ink bg-dangersoft/60 px-3 py-2 text-xs font-bold text-danger"
              >
                ⚠ QR menunjuk ke localhost — isi NEXT_PUBLIC_SITE_URL dengan
                domain production agar QR bisa discan.
              </p>
            )}
            <a
              href={qrDataUrl}
              download={`qr-${p.name}.png`}
              className={`${BTN} lift mt-3 inline-block bg-butter text-ink`}
            >
              ↓ Download QR
            </a>
            <form action={setArchived} className="mt-2">
              <input type="hidden" name="id" value={p.id} />
              <input
                type="hidden"
                name="archived"
                value={p.is_archived ? "false" : "true"}
              />
              <SubmitButton
                pendingChildren="Menyimpan…"
                className={`${BTN} w-full bg-paper hover:bg-lavender`}
              >
                {p.is_archived ? "Unarchive Project" : "Archive Project"}
              </SubmitButton>
            </form>
            {p.is_archived && (
              <p role="note" className="mt-2 text-xs font-bold text-danger">
                ✕ Archived: QR mati, scan ditolak.
              </p>
            )}
            <div className="mt-3 border-t-2 border-dashed border-ink/30 pt-3">
              <DeleteProjectButton
                projectId={p.id}
                projectName={p.name}
                sessionCount={sessionCount}
              />
            </div>
          </div>
        </Window>

        <Window title="Edit_Project.Exe" bar="bg-lavender">
          <form
            action={updateProject}
            key={`edit-${p.id}-${p.updated_at}`}
            className="space-y-4"
          >
            <input type="hidden" name="id" value={p.id} />
            <Field label="Nama">
              <input
                type="text"
                name="name"
                required
                maxLength={200}
                autoComplete="off"
                defaultValue={p.name}
                className={inputCls}
              />
            </Field>
            <Field label="Process">
              <select
                name="process"
                defaultValue={p.process}
                className={inputCls}
              >
                <option value="Machining">Machining</option>
                <option value="Assembly">Assembly</option>
                <option value="Trial">Trial</option>
                <option value="Design">Design</option>
              </select>
            </Field>
            <SubmitButton
              pendingChildren="Menyimpan…"
              className={`${BTN} lift w-full bg-ink text-white`}
            >
              Simpan Perubahan
            </SubmitButton>
          </form>
        </Window>
      </div>

      <Window
        title={`Riwayat_Record.Exe — ${sessionCount}× · Hal ${spage}/${sessionPages}`}
        bar="bg-mint"
        className="mt-4"
        bare
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-2xl text-left text-sm">
            <thead>
              <tr className="border-b-2 border-ink font-mono text-xs tracking-widest text-inksoft uppercase">
                <th scope="col" className="px-4 py-2.5 font-bold">
                  #
                </th>
                <th scope="col" className="px-4 py-2.5 font-bold">
                  Clock In
                </th>
                <th scope="col" className="px-4 py-2.5 font-bold">
                  Clock Out
                </th>
                <th scope="col" className="px-4 py-2.5 font-bold">
                  Operator
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-bold">
                  Durasi
                </th>
                <th scope="col" className="px-4 py-2.5 font-bold">
                  Koreksi
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((s, i) => {
                const secs = sessionSecs(s);
                const num = sessionCount - ((spage - 1) * PER_SESSION + i);
                return (
                  <tr
                    key={s.id}
                    className="border-b border-frame transition-colors duration-150 last:border-0 hover:bg-paperdim"
                  >
                    <td className="px-4 py-3">
                      <span className="inline-block rounded border-2 border-ink bg-butter px-1.5 py-0.5 font-mono text-[11px] font-bold">
                        #{num}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="block font-mono font-bold tabular-nums">
                        {fmtTimeWIB(s.clock_in)}
                      </span>
                      <span className="block font-mono text-xs text-inksoft tabular-nums">
                        {fmtDateWIB(s.clock_in)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {s.clock_out ? (
                        <>
                          <span className="block font-mono font-bold tabular-nums">
                            {fmtTimeWIB(s.clock_out)}
                          </span>
                          <span className="block font-mono text-xs text-inksoft tabular-nums">
                            {fmtDateWIB(s.clock_out)}
                          </span>
                        </>
                      ) : (
                        <span className="font-bold text-success">● aktif</span>
                      )}
                    </td>
                    <td className="max-w-40 px-4 py-3 text-sm">
                    <span className="block truncate font-bold">
                      {s.clock_in_by ?? "—"}
                    </span>
                    <span className="block truncate text-xs text-inksoft">
                      → {s.clock_out_by ?? "…"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-display font-bold text-bubblegumink tabular-nums">
                      {secs === null ? "—" : fmtDuration(secs)}
                    </td>
                    <td className="px-4 py-3">
                      <details>
                        <summary className="mark-link inline cursor-pointer rounded font-mono text-sm font-bold tracking-wider uppercase">
                          Edit
                        </summary>
                        <CorrectionForm
                          key={`corr-${s.id}-${s.clock_in}-${s.clock_out ?? "aktif"}-${s.clock_in_by ?? ""}-${s.clock_out_by ?? ""}`}
                          s={s}
                          projectId={p.id}
                        />
                        <form action={removeSession} className="mt-2">
                          <input type="hidden" name="session_id" value={s.id} />
                          <input type="hidden" name="project_id" value={p.id} />
                          <SubmitButton
                            pendingChildren="Menghapus…"
                            className="press min-h-9 w-full rounded border-2 border-ink bg-paper px-3 py-1.5 font-mono text-xs font-bold uppercase text-danger shadow-brutal-sm hover:bg-dangersoft/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
                          >
                            Hapus record
                          </SubmitButton>
                        </form>
                      </details>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <EmptyRow colSpan={6}>
                  Belum ada record. Scan QR untuk Clock In pertama.
                </EmptyRow>
              )}
            </tbody>
          </table>
        </div>
        <Pager
          base={`/admin/projects/${id}`}
          keep={{ spage, apage }}
          page={spage}
          totalPages={sessionPages}
          param="spage"
        />
      </Window>

      {auditTotal !== null && auditTotal > 0 && (
        <Window
          title={`Audit_Koreksi.Exe — ${auditTotal}× · Hal ${apage}/${auditPages}`}
          bar="bg-peach"
          className="mt-4"
          bare
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-xl text-left text-xs">
              <thead>
                <tr className="border-b-2 border-ink tracking-widest text-inksoft uppercase">
                  <th scope="col" className="px-4 py-2.5 font-bold">
                    Waktu
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-bold">
                    Aksi
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-bold">
                    Perubahan
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-bold">
                    Alasan
                  </th>
                </tr>
              </thead>
              <tbody>
                {((corrections ?? []) as Correction[]).map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-frame last:border-0"
                  >
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                      {c.created_at ? fmtDateTimeWIB(c.created_at) : "—"}
                    </td>
                    <td className="px-4 py-3 font-bold">{c.action}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      {c.old_clock_in && c.new_clock_in
                        ? `${fmtTimeWIB(c.old_clock_in)} → ${fmtTimeWIB(c.new_clock_in)}`
                        : "record dihapus"}
                    </td>
                    <td className="max-w-48 truncate px-4 py-3">
                      {c.reason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager
            base={`/admin/projects/${id}`}
            keep={{ spage, apage }}
            page={apage}
            totalPages={auditPages}
            param="apage"
          />
        </Window>
      )}
    </div>
  );
}
