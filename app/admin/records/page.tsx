import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fmtDuration, fmtDateWIB, fmtTimeWIB } from "@/lib/format";
import { EmptyRow, SectionBar } from "@/components/ui";

export const instant = false;

const PER_PAGE = 20;
const PROCESSES = ["Machining", "Assembly", "Trial"] as const;

interface RecordRow {
  id: string;
  clock_in: string;
  clock_out: string | null;
  projects: { id: string; name: string; process: string };
}

interface Filters {
  q: string;
  process: string;
  from: string;
  to: string;
}

function recordSecs(clockIn: string, clockOut: string | null): number | null {
  if (!clockOut) return null;
  return Math.max(
    0,
    Math.round(
      (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 1000,
    ),
  );
}

/** Bangun URL halaman dengan filter yang sama. */
function pageHref(f: Filters, page: number): string {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.process) sp.set("process", f.process);
  if (f.from) sp.set("from", f.from);
  if (f.to) sp.set("to", f.to);
  if (page > 1) sp.set("page", String(page));
  const s = sp.toString();
  return `/admin/records${s ? `?${s}` : ""}`;
}

const CONTROL_CLS =
  "min-h-11 rounded border-2 border-ink bg-paper px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export default async function RecordsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    process?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  await connection();
  const sp = (await searchParams) ?? {};
  const f: Filters = {
    q: (sp.q ?? "").trim(),
    process: sp.process ?? "",
    from: sp.from ?? "",
    to: sp.to ?? "",
  };
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("work_sessions")
    .select("id, clock_in, clock_out, projects!inner(id, name, process)", {
      count: "exact",
    })
    .eq("projects.is_archived", false)
    .order("clock_in", { ascending: false });
  if (f.q) query = query.ilike("projects.name", `%${f.q}%`);
  if (f.process) query = query.eq("projects.process", f.process);
  if (f.from) query = query.gte("clock_in", `${f.from}T00:00:00+07:00`);
  if (f.to) query = query.lte("clock_in", `${f.to}T23:59:59.999+07:00`);

  const from = (page - 1) * PER_PAGE;
  const { data, count } = await query.range(from, from + PER_PAGE - 1);
  const records = (data ?? []) as unknown as RecordRow[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const safePage = Math.min(page, totalPages);

  // Nomor halaman compact: 1 … sekitar … akhir
  const pages: (number | "…")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - safePage) <= 1) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase">
            Rekap Record
          </h1>
          <p className="font-mono text-xs tracking-widest text-inksoft uppercase">
            {total} record lintas project
          </p>
        </div>
        <form method="get" action="/admin/records/export">
          <input type="hidden" name="q" value={f.q} />
          <input type="hidden" name="process" value={f.process} />
          <input type="hidden" name="from" value={f.from} />
          <input type="hidden" name="to" value={f.to} />
          <button
            type="submit"
            className="press lift min-h-11 cursor-pointer rounded border-2 border-ink bg-butter px-4 py-2.5 font-mono text-sm font-bold tracking-wider uppercase shadow-brutal-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            ↓ Export CSV
          </button>
        </form>
      </div>

      <div className="mt-4 border-2 border-ink bg-paper p-3 shadow-brutal-sm">
        <form
          method="get"
          className="flex flex-wrap items-center gap-2"
          role="search"
          aria-label="Cari record"
        >
          <input
            type="search"
            name="q"
            defaultValue={f.q}
            placeholder="Cari nama project…"
            autoComplete="off"
            aria-label="Cari nama project"
            className={`${CONTROL_CLS} min-w-40 flex-1`}
          />
          <select
            name="process"
            defaultValue={f.process}
            aria-label="Filter process"
            className={CONTROL_CLS}
          >
            <option value="">Semua process</option>
            {PROCESSES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm font-bold">
            <span className="font-mono text-[11px] tracking-wider uppercase">
              Dari
            </span>
            <input
              type="date"
              name="from"
              defaultValue={f.from}
              aria-label="Dari tanggal"
              className={CONTROL_CLS}
            />
          </label>
          <label className="flex items-center gap-1.5 text-sm font-bold">
            <span className="font-mono text-[11px] tracking-wider uppercase">
              Sampai
            </span>
            <input
              type="date"
              name="to"
              defaultValue={f.to}
              aria-label="Sampai tanggal"
              className={CONTROL_CLS}
            />
          </label>
          <button
            type="submit"
            className="press lift min-h-11 cursor-pointer rounded border-2 border-ink bg-ink px-4 py-2 font-mono text-sm font-bold tracking-wider text-white uppercase shadow-brutal-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Cari
          </button>
          {(f.q || f.process || f.from || f.to) && (
            <Link
              href="/admin/records"
              className="press min-h-11 rounded border-2 border-ink bg-paper px-4 py-2 font-mono text-sm font-bold tracking-wider uppercase shadow-brutal-sm hover:bg-lavender focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Reset
            </Link>
          )}
        </form>
      </div>

      <div className="mt-4">
        <SectionBar
          title={`Hasil — Hal ${safePage}/${totalPages}`}
          bar="bg-butter"
        />
        <div className="border-2 border-t-0 border-ink bg-paper shadow-brutal">
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl text-left text-sm">
              <thead>
                <tr className="border-b-2 border-ink font-mono text-xs tracking-widest text-inksoft uppercase">
                  <th scope="col" className="px-4 py-2.5 font-bold">
                    Tanggal
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-bold">
                    Project
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
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const secs = recordSecs(r.clock_in, r.clock_out);
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-frame transition-colors duration-150 last:border-0 hover:bg-paperdim"
                    >
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                        {fmtDateWIB(r.clock_in)}
                      </td>
                      <td className="min-w-0 px-4 py-3">
                        <Link
                          href={`/admin/projects/${r.projects.id}`}
                          className="mark-link block max-w-56 truncate font-bold"
                        >
                          {r.projects.name}
                        </Link>
                        <span className="font-mono text-[11px] tracking-wider text-inksoft uppercase">
                          {r.projects.process}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap tabular-nums">
                        {fmtTimeWIB(r.clock_in)}
                      </td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap tabular-nums">
                        {r.clock_out ? (
                          fmtTimeWIB(r.clock_out)
                        ) : (
                          <span className="font-sans font-bold text-success">
                            ● aktif
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-display font-bold text-bubblegumink tabular-nums">
                        {secs === null ? "—" : fmtDuration(secs)}
                      </td>
                    </tr>
                  );
                })}
                {records.length === 0 && (
                  <EmptyRow colSpan={5}>
                    Tidak ada record yang cocok. Ubah kata kunci atau tanggal.
                  </EmptyRow>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <nav
              aria-label="Pagination record"
              className="flex flex-wrap items-center justify-center gap-1 border-t-2 border-ink bg-paperdim px-3 py-3"
            >
              {safePage > 1 && (
                <Link
                  href={pageHref(f, safePage - 1)}
                  className="press rounded border-2 border-ink bg-paper px-3 py-1.5 font-mono text-xs font-bold uppercase shadow-brutal-sm hover:bg-lavender"
                >
                  ← Prev
                </Link>
              )}
              {pages.map((p, i) =>
                p === "…" ? (
                  <span
                    key={`e${i}`}
                    className="px-1 font-mono text-xs text-inksoft"
                  >
                    …
                  </span>
                ) : (
                  <Link
                    key={p}
                    href={pageHref(f, p)}
                    aria-current={p === safePage ? "page" : undefined}
                    className={`press rounded border-2 border-ink px-3 py-1.5 font-mono text-xs font-bold shadow-brutal-sm ${
                      p === safePage ? "bg-ink text-white" : "bg-paper hover:bg-lavender"
                    }`}
                  >
                    {p}
                  </Link>
                ),
              )}
              {safePage < totalPages && (
                <Link
                  href={pageHref(f, safePage + 1)}
                  className="press rounded border-2 border-ink bg-paper px-3 py-1.5 font-mono text-xs font-bold uppercase shadow-brutal-sm hover:bg-lavender"
                >
                  Next →
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
