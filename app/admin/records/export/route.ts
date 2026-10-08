import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { data: admin } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!admin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const process = sp.get("process") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";

  let query = supabase
    .from("work_sessions")
    .select("clock_in, clock_out, projects!inner(name, process)")
    .eq("projects.is_archived", false)
    .order("clock_in", { ascending: false })
    .limit(MAX_EXPORT);
  if (q) query = query.ilike("projects.name", `%${escapeLike(q)}%`);
  if (process) query = query.eq("projects.process", process);
  if (from) query = query.gte("clock_in", `${from}T00:00:00+07:00`);
  if (to) query = query.lte("clock_in", `${to}T23:59:59.999+07:00`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as {
    clock_in: string;
    clock_out: string | null;
    projects: { name: string; process: string };
  }[];

  const lines = [
    ["Tanggal", "Project", "Process", "Clock In", "Clock Out", "Durasi", "Status"]
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
        r.projects.name,
        r.projects.process,
        fmtTimeWIB(r.clock_in),
        r.clock_out ? fmtTimeWIB(r.clock_out) : "",
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
