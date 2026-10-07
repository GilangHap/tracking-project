import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import {
  fmtDateWIB,
  fmtTimeWIB,
  fmtDateTimeWIB,
  fmtDuration,
  toWIBInputValue,
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
import {
  updateProject,
  setArchived,
  correctSession,
  removeSession,
} from "@/app/admin/projects/actions";

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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  // Wajib request-time: Supabase JS memanggil Date.now() yang dilarang prerender.
  await connection();
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, process, qr_token, is_archived")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();
  const p = project as Project;

  const { data: sessions } = await supabase
    .from("work_sessions")
    .select("id, project_id, clock_in, clock_out, duration")
    .eq("project_id", id)
    .order("clock_in", { ascending: true });

  const { data: corrections } = await supabase
    .from("session_corrections")
    .select(
      "id, action, old_clock_in, new_clock_in, old_clock_out, new_clock_out, reason, created_at",
    )
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const list = (sessions ?? []) as WorkSession[];
  const totalSecs = list.reduce((a, s) => a + (sessionSecs(s) ?? 0), 0);
  const active = list.find((s) => !s.clock_out) ?? null;
  const status = p.is_archived
    ? "Archived"
    : list.length === 0
      ? "Not Started"
      : active
        ? "Ongoing"
        : "Completed";

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
            {list.length}×
          </p>
        </div>
        <div className="border-2 border-ink bg-paper shadow-brutal-sm">
          <p className="border-b-2 border-ink bg-mint px-2 py-1 font-mono text-[11px] font-bold tracking-widest uppercase">
            Aktif
          </p>
          <p className="px-2 py-2 font-display text-xl font-bold tabular-nums md:text-2xl">
            {active ? fmtTimeWIB(active.clock_in) : "—"}
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
            <a
              href={qrDataUrl}
              download={`qr-${p.name}.png`}
              className={`${BTN} mt-3 inline-block bg-butter text-ink`}
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
              <button type="submit" className={`${BTN} w-full bg-paper`}>
                {p.is_archived ? "Unarchive Project" : "Archive Project"}
              </button>
            </form>
            {p.is_archived && (
              <p role="note" className="mt-2 text-xs font-bold text-danger">
                ✕ Archived: QR mati, scan ditolak.
              </p>
            )}
          </div>
        </Window>

        <Window title="Edit_Project.Exe" bar="bg-lavender">
          <form action={updateProject} className="space-y-4">
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
              </select>
            </Field>
            <button
              type="submit"
              className={`${BTN} w-full bg-ink text-white`}
            >
              Simpan Perubahan
            </button>
          </form>
        </Window>
      </div>

      <Window
        title={`Riwayat_Record.Exe — ${list.length}×`}
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
                return (
                  <tr
                    key={s.id}
                    className="border-b border-frame transition-colors duration-150 last:border-0 hover:bg-paperdim"
                  >
                    <td className="px-4 py-3">
                      <span className="inline-block rounded border-2 border-ink bg-butter px-1.5 py-0.5 font-mono text-[11px] font-bold">
                        #{i + 1}
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
                    <td className="px-4 py-3 text-right font-display font-bold text-bubblegumink tabular-nums">
                      {secs === null ? "—" : fmtDuration(secs)}
                    </td>
                    <td className="px-4 py-3">
                      <details>
                        <summary className="mark-link inline cursor-pointer rounded font-mono text-sm font-bold tracking-wider uppercase">
                          Edit
                        </summary>
                        <form
                          action={correctSession}
                          className="mt-2 min-w-60 space-y-2 rounded border-2 border-ink bg-canvas p-3"
                        >
                          <input type="hidden" name="session_id" value={s.id} />
                          <input type="hidden" name="project_id" value={p.id} />
                          <label className="block font-mono text-[11px] font-bold uppercase">
                            Clock In (WIB)
                            <input
                              type="datetime-local"
                              name="clock_in"
                              required
                              defaultValue={toWIBInputValue(s.clock_in)}
                              className="mt-1 w-full rounded border-2 border-ink bg-paper px-2 py-1.5"
                            />
                          </label>
                          <label className="block font-mono text-[11px] font-bold uppercase">
                            Clock Out (WIB, kosong = aktif)
                            <input
                              type="datetime-local"
                              name="clock_out"
                              defaultValue={
                                s.clock_out ? toWIBInputValue(s.clock_out) : ""
                              }
                              className="mt-1 w-full rounded border-2 border-ink bg-paper px-2 py-1.5"
                            />
                          </label>
                          <input
                            type="text"
                            name="reason"
                            autoComplete="off"
                            placeholder="Alasan, mis. lupa clock out…"
                            aria-label="Alasan koreksi"
                            className="w-full rounded border-2 border-ink bg-paper px-2 py-1.5 text-xs placeholder:text-inkfaint"
                          />
                          <button
                            type="submit"
                            className="press min-h-9 w-full cursor-pointer rounded border-2 border-ink bg-ink px-3 py-1.5 font-mono text-xs font-bold uppercase text-white shadow-brutal-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                          >
                            Simpan koreksi
                          </button>
                        </form>
                        <form action={removeSession} className="mt-2">
                          <input type="hidden" name="session_id" value={s.id} />
                          <input type="hidden" name="project_id" value={p.id} />
                          <button
                            type="submit"
                            className="press min-h-9 w-full cursor-pointer rounded border-2 border-ink bg-paper px-3 py-1.5 font-mono text-xs font-bold uppercase text-danger shadow-brutal-sm hover:bg-dangersoft/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
                          >
                            Hapus record
                          </button>
                        </form>
                      </details>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <EmptyRow colSpan={5}>
                  Belum ada record. Scan QR untuk Clock In pertama.
                </EmptyRow>
              )}
            </tbody>
          </table>
        </div>
      </Window>

      {((corrections ?? []) as Correction[]).length > 0 && (
        <Window
          title="Audit_Koreksi.Exe"
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
        </Window>
      )}
    </div>
  );
}
