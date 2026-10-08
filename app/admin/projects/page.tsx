import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { escapeLike } from "@/lib/search";
import { EmptyRow, SectionBar, StatusBadge } from "@/components/ui";

// Halaman dinamis per request (data sesi login) → navigasi boleh blocking.
export const instant = false;

const PROCESSES = ["Machining", "Assembly", "Trial"] as const;
const STATUSES = ["Not Started", "Ongoing", "Completed", "Archived"] as const;

const CONTROL_CLS =
  "min-h-11 rounded border-2 border-ink bg-paper px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    process?: string;
    status?: string;
    showArchived?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? "").trim();
  const processFilter = sp.process ?? "";
  const statusFilter = sp.status ?? "";
  const showArchived = sp.showArchived === "1";

  // Tanggal project dihapus (v1.2): urut berdasar waktu dibuat.
  // Wajib request-time: Supabase JS memanggil Date.now() yang dilarang prerender.
  await connection();
  const supabase = await createClient();
  let query = supabase
    .from("projects")
    .select("id, name, process, is_archived")
    .order("created_at", { ascending: false });
  if (!showArchived) query = query.eq("is_archived", false);
  if (processFilter) query = query.eq("process", processFilter);
  if (q) query = query.ilike("name", `%${escapeLike(q)}%`);

  const { data: projects } = await query;
  const list = projects ?? [];
  const ids = list.map((p) => p.id);

  const statusById = new Map<string, string>();
  if (ids.length > 0) {
    const { data: statuses } = await supabase
      .from("v_project_status")
      .select("project_id, status")
      .in("project_id", ids);
    for (const s of (statuses ?? []) as {
      project_id: string;
      status: string;
    }[])
      statusById.set(s.project_id, s.status);
  }

  const filtered = statusFilter
    ? list.filter((p) => statusById.get(p.id) === statusFilter)
    : list;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase">
            Projects
          </h1>
          <p className="font-mono text-xs tracking-widest text-inksoft uppercase">
            {filtered.length} project tampil
          </p>
        </div>
        <Link
          href="/admin/projects/create"
          className="press lift rounded border-2 border-ink bg-butter px-4 py-2.5 font-mono text-sm font-bold tracking-wider uppercase shadow-brutal-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          + Project
        </Link>
      </div>

      <div className="mt-4 border-2 border-ink bg-paper p-3 shadow-brutal-sm">
        <form
          method="get"
          className="flex flex-wrap items-center gap-2"
          role="search"
          aria-label="Filter project"
        >
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Cari project…"
            autoComplete="off"
            aria-label="Cari project"
            className={`${CONTROL_CLS} min-w-40 flex-1`}
          />
          <select
            name="process"
            defaultValue={processFilter}
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
          <select
            name="status"
            defaultValue={statusFilter}
            aria-label="Filter status"
            className={CONTROL_CLS}
          >
            <option value="">Semua status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded border-2 border-ink bg-paper px-3 py-2 text-sm font-bold">
            <input
              type="checkbox"
              name="showArchived"
              value="1"
              defaultChecked={showArchived}
              className="h-4 w-4 accent-[#1b1b3a]"
            />
            Archived
          </label>
          <button
            type="submit"
            className="press lift min-h-11 cursor-pointer rounded border-2 border-ink bg-ink px-4 py-2 font-mono text-sm font-bold tracking-wider text-white uppercase shadow-brutal-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Filter
          </button>
        </form>
      </div>

      <div className="mt-4">
        <SectionBar title="Daftar_Project" bar="bg-sky" />
        <div className="border-2 border-t-0 border-ink bg-paper shadow-brutal">
          <div className="overflow-x-auto">
            <table className="w-full min-w-2xl text-left text-sm">
              <thead>
                <tr className="border-b-2 border-ink font-mono text-xs tracking-widest text-inksoft uppercase">
                  <th scope="col" className="px-4 py-2.5 font-bold">
                    Project
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-bold">
                    Process
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-bold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-bold">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-frame transition-colors duration-150 last:border-0 hover:bg-paperdim"
                  >
                    <td className="min-w-0 px-4 py-3 font-bold">
                      <span className="block max-w-56 truncate">
                        {p.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded border-2 border-ink bg-sky/40 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider uppercase">
                        {p.process}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={statusById.get(p.id) ?? "Not Started"}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/projects/${p.id}`}
                        className="mark-link rounded font-mono text-sm font-bold tracking-wider uppercase"
                      >
                        Detail →
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <EmptyRow colSpan={4}>
                    Tidak ada project yang cocok. Ubah filter atau buat
                    project baru.
                  </EmptyRow>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
