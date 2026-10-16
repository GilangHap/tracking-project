import Link from "next/link";
import { WinControls } from "@/components/ui";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="bg-grid flex min-h-screen items-center justify-center bg-canvas px-4">
      <main className="w-full max-w-sm">
        <Link
          href="/"
          className="mark-link mb-3 inline-block rounded font-mono text-sm font-bold tracking-wider uppercase"
        >
          ← Beranda
        </Link>
        <div className="border-2 border-ink bg-paper shadow-brutal-lg">
          <div className="flex items-center justify-between gap-2 border-b-2 border-ink bg-butter px-3 py-1.5">
            <p className="truncate font-mono text-xs font-bold tracking-widest uppercase">
              Login_Admin.Exe
            </p>
            <WinControls />
          </div>
          <div className="p-5 md:p-6" aria-label="Form login admin">
            <span className="font-brand text-xl font-semibold tracking-tight">
              Project<span className="text-bubblegumink">_</span>Tracker
            </span>
            <h1 className="mt-1 font-display text-2xl font-bold uppercase">
              Login Admin
            </h1>
            <div className="mt-5">
              <LoginForm />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
