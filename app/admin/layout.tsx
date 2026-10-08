import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TabBar } from "@/components/tabbar";
import { LogoutButton } from "@/components/logout-button";

// Admin pages memakai sesi login (cookies) → render dinamis per request.
export const instant = false;

const NAV_FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const TABS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/records", label: "Records" },
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
      <div className="bg-grid flex min-h-screen items-center justify-center bg-canvas px-4">
        <main className="w-full max-w-sm border-2 border-ink bg-paper p-6 text-center shadow-brutal">
          <h1 className="font-display text-xl font-bold uppercase">
            Akses ditolak
          </h1>
          <p className="mt-2 text-sm text-inksoft">
            Akun {user.email} bukan admin. Minta admin mendaftarkan akun ini
            ke tabel admins.
          </p>
          <div className="mt-6">
            <LogoutButton full />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-grid flex min-h-screen flex-col bg-canvas">
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
              className={`press lift hidden rounded border-2 border-ink bg-butter px-3 py-1.5 font-mono text-xs font-bold tracking-wider uppercase shadow-brutal-sm sm:block ${NAV_FOCUS}`}
            >
              + Project
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main
        id="admin-main"
        className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 sm:pb-8"
      >
        {children}
      </main>

      {/* Tab bar bawah mobile ala marketplace: tab aktif kuning. */}
      <TabBar />
    </div>
  );
}
