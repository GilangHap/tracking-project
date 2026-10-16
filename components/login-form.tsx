"use client";

import { useActionState } from "react";
import { login } from "@/app/login/actions";
import { Loader } from "@/components/loader";

const initial = { error: null as string | null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initial);

  return (
    <form action={formAction} aria-label="Form login admin">
      <label className="block text-sm font-semibold">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          spellCheck={false}
          placeholder="nama@perusahaan…"
          className="mt-1 w-full rounded border-2 border-ink bg-paper px-4 py-2.5 text-base placeholder:text-inkfaint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        />
      </label>
      <label className="mt-4 block text-sm font-semibold">
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
      {state.error && (
        <p
          role="alert"
          className="mt-4 rounded border-2 border-ink bg-dangersoft/60 px-4 py-3 text-sm font-bold text-danger"
        >
          ✕ {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="press lift mt-6 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded border-2 border-ink bg-butter px-5 py-3 font-mono text-sm font-bold tracking-wider uppercase shadow-brutal-sm disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {pending ? <Loader compact label="Memeriksa" /> : "→ Masuk"}
      </button>
    </form>
  );
}
