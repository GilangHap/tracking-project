import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fmtDuration, fmtDateWIB, fmtTimeWIB } from "@/lib/format";
import type { Project } from "@/lib/types";
import { EmptyRow, SectionBar, Stat } from "@/components/ui";

// Halaman dinamis per request (data sesi login) → navigasi boleh blocking.
export const instant = false;

interface StatusRow {
  project_id: string;
  status: string;
}

interface TotalRow {
  project_id: string;
  total_secs: number;
}

interface RecentRecord {
  id: string;
  clock_in: string;
  clock_out: string | null;
  projects: { id: string; name: string; process: string };
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

export default async function DashboardPage() {
  // Wajib request-time: Supabase JS memanggil Date.now() yang dilarang prerender.
  await connection();
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, process")
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  const list = (projects ?? []) as Pick<Project, "id" | "name" | "process">[];
  const ids = list.map((p) => p.id);

  const statusById = new Map<string, string>();
  const totalById = new Map<string, number>();
  if (ids.length > 0) {
    const { data: statuses } = await supabase
      .from("v_project_status")
      .select("project_id, status")
      .in("project_id", ids);
    const { data: totals } = await supabase
      .from("v_project_totals")
      .select("project_id, total_secs")
      .in("project_id", ids);
    for (const s of (statuses ?? []) as StatusRow[])
      statusById.set(s.project_id, s.status);
    for (const t of (totals ?? []) as TotalRow[])
      totalById.set(t.project_id, Number(t.total_secs));
  }

  const ongoing = list.filter((p) => statusById.get(p.id) === "Ongoing").length;
  const completed = list.filter(
    (p) => statusById.get(p.id) === "Completed",
  ).length;
  const totalSecs = [...totalById.values()].reduce((a, b) => a + b, 0);

  const { data: recent } = await supabase
    .from("work_sessions")
    .select("id, clock_in, clock_out, projects!inner(id, name, process)")
    .eq("projects.is_archived", false)
    .order("clock_in", { ascending: false })
    .limit(15);
  const records = (recent ?? []) as unknown as RecentRecord[];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase">
            Dashboard
          </h1>
          <p className="font-mono text-xs tracking-widest text-inksoft uppercase">
            Status & total jam kerja
          </p>
        </div>
        <Link
          href="/admin/projects/create"
          className="press lift rounded border-2 border-ink bg-butter px-4 py-2.5 font-mono text-sm font-bold tracking-wider uppercase shadow-brutal-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          + Project
        </Link>
      </div>

      <div
        className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4"
        role="list"
        aria-label="Ringkasan project"
      >
        <Stat
          label="Total Project"
          value={String(list.length)}
          tint="bg-sky"
        />
        <Stat
          label="Ongoing"
          value={String(ongoing)}
          sub="ADA SESSION AKTIF"
          tint="bg-mint"
        />
        <Stat
          label="Completed"
          value={String(completed)}
          sub="IDLE, SIAP SCAN"
          tint="bg-lavender"
        />
        <Stat
          label="Total Durasi"
          value={fmtDuration(totalSecs)}
          sub="WIB"
          tint="bg-peach"
        />
      </div>

      <div className="mt-8">
        <SectionBar
          title="Rekap_Record_Terbaru"
          bar="bg-butter"
          action={
            <Link
              href="/admin/records"
              className="press rounded border-2 border-ink bg-paper px-3 py-1 font-mono text-xs font-bold tracking-wider uppercase shadow-brutal-sm"
            >
              Semua →
            </Link>
          }
        />
        <div className="border-2 border-t-0 border-ink bg-paper shadow-brutal">
          <div className="overflow-x-auto">
            <table className="w-full min-w-2xl text-left text-sm">
              <thead>
                <tr className="border-b-2 border-ink font-mono text-xs tracking-widest text-inksoft uppercase">
                  <th scope="col" className="px-4 py-2.5 font-bold">
                    #
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-bold">
                    Tanggal
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-bold">
                    Project
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-bold">
                    In → Out
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right font-bold"
                  >
                    Durasi
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => {
                  const secs = recordSecs(r.clock_in, r.clock_out);
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-frame transition-colors duration-150 last:border-0 hover:bg-paperdim"
                    >
                      <td className="px-4 py-3">
                        <span className="inline-block rounded border-2 border-ink bg-butter px-1.5 py-0.5 font-mono text-[11px] font-bold">
                          #{i + 1}
                        </span>
                      </td>
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
                        {fmtTimeWIB(r.clock_in)} →{" "}
                        {r.clock_out ? (
                          fmtTimeWIB(r.clock_out)
                        ) : (
                          <span className="font-sans font-bold text-success">
                            ● aktif
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-display text-base font-bold text-bubblegumink tabular-nums">
                        {secs === null ? "—" : fmtDuration(secs)}
                      </td>
                    </tr>
                  );
                })}
                {records.length === 0 && (
                  <EmptyRow colSpan={5}>
                    Belum ada record. Scan QR project untuk Clock In pertama.
                  </EmptyRow>
                )}
              </tbody>
            </table>
          </div>
          <div
            aria-hidden="true"
            className="border-t-2 border-ink bg-paper px-3 py-2"
          />
        </div>
      </div>
    </div>
  );
}
