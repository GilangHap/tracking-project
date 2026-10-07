"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WinControls } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(formData: FormData) {
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      });
      if (error) {
        setError("Email atau password salah. Periksa kembali…");
        return;
      }
      router.push("/admin/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-grid flex min-h-screen items-center justify-center bg-canvas px-4">
      <main className="w-full max-w-sm border-2 border-ink bg-paper shadow-brutal-lg">
        <div className="flex items-center justify-between gap-2 border-b-2 border-ink bg-butter px-3 py-1.5">
          <p className="truncate font-mono text-xs font-bold tracking-widest uppercase">
            Login_Admin.Exe
          </p>
          <WinControls />
        </div>
        <form
          action={onSubmit}
          className="p-5 md:p-6"
          aria-label="Form login admin"
        >
          <p className="font-brand text-xl font-semibold tracking-tight">
            Project<span className="text-bubblegumink">_</span>Tracker
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold uppercase">
            Login Admin
          </h1>
          <label className="mt-5 block font-mono text-xs font-bold tracking-widest uppercase">
            Email
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              spellCheck={false}
              placeholder="nama@perusahaan…"
              className="mt-1 w-full rounded border-2 border-ink bg-paper px-4 py-2.5 text-base normal-case placeholder:text-inkfaint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            />
          </label>
          <label className="mt-4 block font-mono text-xs font-bold tracking-widest uppercase">
            Password
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="mt-1 w-full rounded border-2 border-ink bg-paper px-4 py-2.5 text-base placeholder:text-inkfaint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            />
          </label>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded border-2 border-ink bg-dangersoft/60 px-4 py-3 text-sm font-bold text-danger"
            >
              ✕ {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="press mt-6 min-h-12 w-full cursor-pointer rounded border-2 border-ink bg-butter px-5 py-3 font-mono text-sm font-bold tracking-wider uppercase shadow-brutal-sm disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {loading ? "Memeriksa…" : "→ Masuk"}
          </button>
        </form>
      </main>
    </div>
  );
}
