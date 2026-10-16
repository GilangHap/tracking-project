import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { escapeLike } from "@/lib/search";
import { fmtDuration, fmtDateWIB, fmtTimeWIB } from "@/lib/format";

const MAX_EXPORT = 10000;

function csvCell(v: string | number): string {
  let s = String(v);
  // Anti formula-injection: sel yang diawali = + - @ (atau tab/CR)
  // dipaksa jadi teks agar Excel tidak mengeksekusinya.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function stampWIB(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}${get("month")}${get("day")}-${get("hour")}${get("minute")}`;
}

/** Export CSV seluruh record sesuai filter (admin only). */
export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as unknown as { role?: string } | undefined)
    ?.role;
  if (!session?.user)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (role !== "admin")
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const process = sp.get("process") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";

  const conds = ["p.is_archived = false"];
  const params: unknown[] = [];
  if (q) {
    params.push(`%${escapeLike(q)}%`);
    conds.push(`p.name ilike $${params.length}`);
  }
  if (process) {
    params.push(process);
    conds.push(`p.process = $${params.length}::project_process`);
  }
  if (from) {
    params.push(`${from}T00:00:00+07:00`);
    conds.push(`s.clock_in >= $${params.length}::timestamptz`);
  }
  if (to) {
    params.push(`${to}T23:59:59.999+07:00`);
    conds.push(`s.clock_in <= $${params.length}::timestamptz`);
  }
  params.push(MAX_EXPORT);

  let rows: {
    clock_in: string;
    clock_out: string | null;
    clock_in_by: string | null;
    clock_out_by: string | null;
    project_name: string;
    project_process: string;
  }[];
  try {
    const res = await db.query<{
      clock_in: string;
      clock_out: string | null;
      clock_in_by: string | null;
      clock_out_by: string | null;
      project_name: string;
      project_process: string;
    }>(
      `select s.clock_in, s.clock_out, s.clock_in_by, s.clock_out_by,
              p.name as project_name, p.process as project_process
       from public.work_sessions s
       join public.projects p on p.id = s.project_id
       where ${conds.join(" and ")}
       order by s.clock_in desc
       limit $${params.length}`,
      params,
    );
    rows = res.rows;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const lines = [
    [
      "Tanggal",
      "Project",
      "Process",
      "Clock In",
      "Clock In Oleh",
      "Clock Out",
      "Clock Out Oleh",
      "Durasi",
      "Status",
    ]
      .map(csvCell)
      .join(";"),
  ];
  for (const r of rows) {
    const secs = r.clock_out
      ? Math.max(
          0,
          Math.round(
            (new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()) /
              1000,
          ),
        )
      : null;
    lines.push(
      [
        fmtDateWIB(r.clock_in),
        r.project_name,
        r.project_process,
        fmtTimeWIB(r.clock_in),
        r.clock_in_by ?? "",
        r.clock_out ? fmtTimeWIB(r.clock_out) : "",
        r.clock_out_by ?? "",
        secs === null ? "" : fmtDuration(secs),
        secs === null ? "AKTIF" : "SELESAI",
      ]
        .map(csvCell)
        .join(";"),
    );
  }

  // BOM agar Excel Windows membuka UTF-8 dengan benar; separator ; ala ID.
  const csv = "﻿" + lines.join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rekap-record-${stampWIB(new Date())}.csv"`,
    },
  });
}
