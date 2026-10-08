import Link from "next/link";

/**
 * Navigasi halaman compact untuk tabel admin.
 * `param` = query mana yang diubah; param lain dipertahankan.
 */
export function Pager({
  base,
  keep,
  page,
  totalPages,
  param,
}: {
  base: string;
  keep: Record<string, number>;
  page: number;
  totalPages: number;
  param: string;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...keep, [param]: p })) {
      if (v > 1) sp.set(k, String(v));
    }
    const q = sp.toString();
    return `${base}${q ? `?${q}` : ""}`;
  };

  const pages: (number | "…")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  const btn =
    "press rounded border-2 border-ink bg-paper px-3 py-1.5 font-mono text-xs font-bold uppercase shadow-brutal-sm hover:bg-lavender";

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-center gap-1 border-t-2 border-ink bg-paperdim px-3 py-3"
    >
      {page > 1 && (
        <Link href={href(page - 1)} className={btn}>
          ← Prev
        </Link>
      )}
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-1 font-mono text-xs text-inksoft">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={`press rounded border-2 border-ink px-3 py-1.5 font-mono text-xs font-bold shadow-brutal-sm ${
              p === page ? "bg-ink text-white" : "bg-paper hover:bg-lavender"
            }`}
          >
            {p}
          </Link>
        ),
      )}
      {page < totalPages && (
        <Link href={href(page + 1)} className={btn}>
          Next →
        </Link>
      )}
    </nav>
  );
}
