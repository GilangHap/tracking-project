"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/records", label: "Records" },
] as const;

/** Tab bar bawah mobile: tab aktif kuning butter. */
export function TabBar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin/projects/create"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Navigasi cepat"
      className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-3 border-t-2 border-ink bg-paper sm:hidden"
    >
      {TABS.map((t) => {
        const active = isActive(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`border-r-2 border-ink py-3 text-center font-mono text-xs font-bold tracking-wider uppercase last:border-r-0 active:bg-butter ${
              active ? "bg-butter" : ""
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
