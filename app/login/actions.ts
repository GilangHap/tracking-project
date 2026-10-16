"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export async function login(
  _prev: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/admin/dashboard",
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: "Email atau password salah. Periksa kembali…" };
    }
    throw e;
  }
  return { error: null };
}
