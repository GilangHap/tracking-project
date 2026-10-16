"use server";

import { db } from "@/lib/db";
import type { ClockResult } from "@/lib/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Clock In/Out publik via RPC atomic (single writer + intent check). */
export async function clockAction(
  token: string,
  operatorName: string,
  expectedAction: "IN" | "OUT",
): Promise<ClockResult> {
  if (!UUID_RE.test(token)) throw new Error("PROJECT_NOT_FOUND");
  try {
    const { rows } = await db.query<{ out: ClockResult }>(
      "select public.clock_toggle($1, $2, $3) as out",
      [token, operatorName, expectedAction],
    );
    return rows[0].out;
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "UNKNOWN");
  }
}
