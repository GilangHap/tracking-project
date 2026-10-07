import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/admin/projects/actions";

// Admin pages memakai sesi login (cookies) → render dinamis per request.
export const instant = false;

const NAV_FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const TABS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/projects", label: "Projects" },
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
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

  if (!admin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <main className="w-full max-w-sm border-2 border-ink bg-paper p-6 text-center shadow-brutal">
          <h1 className="font-display text-xl font-bold uppercase">
            Akses ditolak
          </h1>
          <p className="mt-2 text-sm text-inksoft">
            Akun {user.email} bukan admin. Minta admin mendaftarkan akun ini
            ke tabel admins.
          </p>
          <form action={logout} className="mt-6">
            <button
              className={`press min-h-11 w-full cursor-pointer rounded border-2 border-ink bg-butter px-5 py-2.5 font-mono text-sm font-bold uppercase shadow-brutal-sm ${NAV_FOCUS}`}
            >
              Keluar
            </button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:border-2 focus:border-ink focus:bg-paper focus:px-4 focus:py-2 focus:font-mono focus:text-sm focus:font-bold"
      >
        Lewati ke konten
      </a>
      <header className="sticky top-0 z-10 border-b-2 border-ink bg-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate font-brand text-lg font-semibold tracking-tight">
              Project<span className="text-bubblegumink">_</span>Tracker
            </p>
            <nav
              aria-label="Navigasi admin"
              className="hidden gap-1 sm:flex"
            >
              {TABS.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`press rounded border-2 border-ink bg-paper px-3 py-1.5 font-mono text-xs font-bold tracking-wider uppercase shadow-brutal-sm hover:bg-lavender ${NAV_FOCUS}`}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/projects/create"
              className={`press hidden rounded border-2 border-ink bg-butter px-3 py-1.5 font-mono text-xs font-bold tracking-wider uppercase shadow-brutal-sm sm:block ${NAV_FOCUS}`}
            >
              + Project
            </Link>
            <form action={logout}>
              <button
                className={`press min-h-9 cursor-pointer rounded border-2 border-ink bg-paper px-3 py-1.5 font-mono text-xs font-bold uppercase shadow-brutal-sm hover:bg-dangersoft/50 ${NAV_FOCUS}`}
              >
                Keluar
              </button>
            </form>
          </div>
        </div>
      </header>

      <main
        id="admin-main"
        className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 sm:pb-8"
      >
        {children}
      </main>

      {/* Tab bar bawah ala mobile marketplace */}
      <nav
        aria-label="Navigasi cepat"
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-3 border-t-2 border-ink bg-paper sm:hidden"
      >
        {[
          ...TABS,
          { href: "/admin/projects/create", label: "+ Baru" },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="border-r-2 border-ink py-3 text-center font-mono text-xs font-bold tracking-wider uppercase last:border-r-0 active:bg-butter"
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
