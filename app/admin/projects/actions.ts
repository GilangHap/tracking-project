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
  if (!name || !process) throw new Error("INVALID_INPUT");

  const { data, error } = await supabase
    .from("projects")
    .insert({
      name,
      process,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/projects");
  revalidatePath("/admin/dashboard");
  redirect(`/admin/projects/${data.id}`);
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

export async function correctSession(formData: FormData) {
  const { supabase } = await requireAdmin();
  const session_id = String(formData.get("session_id") ?? "");
  const project_id = String(formData.get("project_id") ?? "");
  const rawIn = String(formData.get("clock_in") ?? "");
  const rawOut = String(formData.get("clock_out") ?? "");
  const reason = String(formData.get("reason") ?? "") || null;
  if (!session_id || !project_id || !rawIn) throw new Error("INVALID_INPUT");

  const { error } = await supabase.rpc("correct_session", {
    p_session_id: session_id,
    p_new_in: wibInputToISO(rawIn),
    p_new_out: rawOut ? wibInputToISO(rawOut) : null,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/projects/${project_id}`);
  revalidatePath("/admin/dashboard");
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
