"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { db, withAdmin, withTx } from "@/lib/db";
import { wibInputToISO } from "@/lib/format";

function pgMessage(e: unknown): string {
  return e instanceof Error ? e.message : "UNKNOWN";
}

function pgCode(e: unknown): string {
  return typeof e === "object" && e !== null && "code" in e
    ? String((e as { code: unknown }).code)
    : "";
}

async function requireAdminId(): Promise<string> {
  const session = await auth();
  const uid = (session?.user as unknown as { id?: string } | undefined)?.id;
  const role = (session?.user as unknown as { role?: string } | undefined)
    ?.role;
  if (!uid || role !== "admin") redirect("/login");
  return uid;
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

export async function createProject(formData: FormData) {
  const adminId = await requireAdminId();
  const name = String(formData.get("name") ?? "").trim();
  const process = String(formData.get("process") ?? "");
  const rawKey = String(formData.get("client_key") ?? "").trim();
  const clientKey =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      rawKey,
    )
      ? rawKey
      : null;
  if (!name || !process) throw new Error("INVALID_INPUT");

  async function goTo(id: string): Promise<never> {
    revalidatePath("/admin/projects");
    revalidatePath("/admin/dashboard");
    redirect(`/admin/projects/${id}`);
  }

  // Klik ganda berurutan: key sama sudah ada → pakai yang ada.
  if (clientKey) {
    const { rows } = await db.query<{ id: string }>(
      "select id from public.projects where client_key = $1",
      [clientKey],
    );
    if (rows[0]) await goTo(rows[0].id);
  }

  // redirect() melempar NEXT_REDIRECT — jangan pernah ada di dalam try.
  let id: string;
  try {
    const { rows } = await db.query<{ id: string }>(
      "insert into public.projects (name, process, created_by, client_key) values ($1, $2, $3, $4) returning id",
      [name, process, adminId, clientKey],
    );
    id = rows[0].id;
  } catch (e) {
    // Klik ganda bersamaan: salah satu kalah unique → pakai pemenang.
    if (pgCode(e) === "23505" && clientKey) {
      const { rows } = await db.query<{ id: string }>(
        "select id from public.projects where client_key = $1",
        [clientKey],
      );
      if (rows[0]) await goTo(rows[0].id);
    }
    console.error("[createProject] pg error:", pgMessage(e));
    throw new Error(pgMessage(e));
  }
  await goTo(id);
}

export async function updateProject(formData: FormData) {
  await requireAdminId();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const process = String(formData.get("process") ?? "");
  if (!id || !name || !process) throw new Error("INVALID_INPUT");

  await db.query(
    "update public.projects set name = $1, process = $2 where id = $3",
    [name, process, id],
  );
  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${id}`);
  revalidatePath("/admin/dashboard");
}

export async function setArchived(formData: FormData) {
  await requireAdminId();
  const id = String(formData.get("id") ?? "");
  const archived = String(formData.get("archived") ?? "") === "true";
  if (!id) throw new Error("INVALID_INPUT");

  await db.query("update public.projects set is_archived = $1 where id = $2", [
    archived,
    id,
  ]);
  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${id}`);
  revalidatePath("/admin/dashboard");
}

export type ActionState = { error: string | null };

/**
 * Hapus permanen project + seluruh record + auditnya dalam 1 transaksi.
 * Tidak bisa dibatalkan. Nama project wajib diketik ulang (diverifikasi server).
 */
export async function deleteProject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminId();
  const id = String(formData.get("id") ?? "");
  const typedName = String(formData.get("confirm_name") ?? "").trim();
  if (!id) return { error: "Project tidak valid." };

  const { rows } = await db.query<{
    name: string;
    sessions: string;
  }>(
    `select p.name, (select count(*)::text from public.work_sessions s where s.project_id = p.id) as sessions
     from public.projects p where p.id = $1`,
    [id],
  );
  const target = rows[0];
  if (!target) return { error: "Project tidak ditemukan." };
  if (typedName !== target.name)
    return { error: "Nama tidak cocok. Hapus dibatalkan." };

  // Urutan penting (FK RESTRICT): audit → session → project.
  try {
    await withTx(async (c) => {
      await c.query(
        "delete from public.session_corrections where project_id = $1",
        [id],
      );
      await c.query("delete from public.work_sessions where project_id = $1", [
        id,
      ]);
      await c.query("delete from public.projects where id = $1", [id]);
    });
  } catch (e) {
    return { error: `Gagal menghapus: ${pgMessage(e)}` };
  }
  revalidatePath("/admin/projects");
  revalidatePath("/admin/dashboard");
  redirect("/admin/projects");
}

function mapCorrectError(code: string): string {
  if (code.includes("INVALID_TIME_ORDER"))
    return "Jam Clock Out harus setelah Clock In.";
  if (code.includes("SESSION_OVERLAP"))
    return "Waktu bertabrakan dengan record lain project ini.";
  if (code.includes("MULTIPLE_ACTIVE_FORBIDDEN"))
    return "Sudah ada record aktif lain — nonaktifkan dulu.";
  if (code.includes("SESSION_NOT_FOUND"))
    return "Record tidak ditemukan (mungkin baru dihapus).";
  if (code.includes("INVALID_INPUT"))
    return "Isian tanggal/jam tidak valid.";
  return "Gagal menyimpan koreksi. Coba lagi.";
}

export async function correctSession(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const adminId = await requireAdminId();
  const session_id = String(formData.get("session_id") ?? "");
  const project_id = String(formData.get("project_id") ?? "");
  const rawIn = String(formData.get("clock_in") ?? "");
  const rawOut = String(formData.get("clock_out") ?? "");
  const reason = String(formData.get("reason") ?? "") || null;
  const inBy = String(formData.get("clock_in_by") ?? "").trim() || null;
  const outBy = String(formData.get("clock_out_by") ?? "").trim() || null;
  if (!session_id || !project_id || !rawIn)
    return { error: "Isian tanggal/jam tidak valid." };

  try {
    await withAdmin(adminId, (c) =>
      c.query("select public.correct_session($1, $2, $3, $4, $5, $6)", [
        session_id,
        wibInputToISO(rawIn),
        rawOut ? wibInputToISO(rawOut) : null,
        reason,
        inBy,
        outBy,
      ]),
    );
  } catch (e) {
    return { error: mapCorrectError(pgMessage(e)) };
  }
  revalidatePath(`/admin/projects/${project_id}`);
  revalidatePath("/admin/dashboard");
  return { error: null };
}

export async function removeSession(formData: FormData) {
  const adminId = await requireAdminId();
  const session_id = String(formData.get("session_id") ?? "");
  const project_id = String(formData.get("project_id") ?? "");
  const reason = String(formData.get("reason") ?? "") || null;
  if (!session_id || !project_id) throw new Error("INVALID_INPUT");

  try {
    await withAdmin(adminId, (c) =>
      c.query("select public.delete_session($1, $2)", [session_id, reason]),
    );
  } catch (e) {
    throw new Error(pgMessage(e));
  }
  revalidatePath(`/admin/projects/${project_id}`);
  revalidatePath("/admin/dashboard");
}
