"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { wibInputToISO } from "@/lib/format";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: admin } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!admin) throw new Error("FORBIDDEN_NOT_ADMIN");
  return { supabase, user };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createProject(formData: FormData) {
  const { supabase, user } = await requireAdmin();
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

  async function goTo(id: string) {
    revalidatePath("/admin/projects");
    revalidatePath("/admin/dashboard");
    redirect(`/admin/projects/${id}`);
  }

  // Klik ganda berurutan: key sama sudah ada → pakai yang ada.
  if (clientKey) {
    const { data: existing } = await supabase
      .from("projects")
      .select("id")
      .eq("client_key", clientKey)
      .maybeSingle();
    if (existing) await goTo(existing.id);
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      name,
      process,
      created_by: user.id,
      client_key: clientKey,
    })
    .select("id")
    .single();
  if (error) {
    // Klik ganda bersamaan: salah satu kalah unique → pakai pemenang.
    if (error.code === "23505" && clientKey) {
      const { data: existing } = await supabase
        .from("projects")
        .select("id")
        .eq("client_key", clientKey)
        .maybeSingle();
      if (existing) await goTo(existing.id);
    }
    throw new Error(error.message);
  }
  await goTo(data.id);
}

export async function updateProject(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const process = String(formData.get("process") ?? "");
  if (!id || !name || !process) throw new Error("INVALID_INPUT");

  const { error } = await supabase
    .from("projects")
    .update({ name, process })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${id}`);
  revalidatePath("/admin/dashboard");
}

export async function setArchived(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const archived = String(formData.get("archived") ?? "") === "true";
  if (!id) throw new Error("INVALID_INPUT");

  const { error } = await supabase
    .from("projects")
    .update({ is_archived: archived })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${id}`);
  revalidatePath("/admin/dashboard");
}

export type ActionState = { error: string | null };

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
  const { supabase } = await requireAdmin();
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
    const { error } = await supabase.rpc("correct_session", {
      p_session_id: session_id,
      p_new_in: wibInputToISO(rawIn),
      p_new_out: rawOut ? wibInputToISO(rawOut) : null,
      p_reason: reason,
      p_new_in_by: inBy,
      p_new_out_by: outBy,
    });
    if (error) return { error: mapCorrectError(error.message) };
  } catch {
    return { error: "Isian tanggal/jam tidak valid." };
  }
  revalidatePath(`/admin/projects/${project_id}`);
  revalidatePath("/admin/dashboard");
  return { error: null };
}

export async function removeSession(formData: FormData) {
  const { supabase } = await requireAdmin();
  const session_id = String(formData.get("session_id") ?? "");
  const project_id = String(formData.get("project_id") ?? "");
  const reason = String(formData.get("reason") ?? "") || null;
  if (!session_id || !project_id) throw new Error("INVALID_INPUT");

  const { error } = await supabase.rpc("delete_session", {
    p_session_id: session_id,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/projects/${project_id}`);
  revalidatePath("/admin/dashboard");
}
