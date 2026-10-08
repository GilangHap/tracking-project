const COLORS = ["bg-sky", "bg-butter", "bg-bubblegum"] as const;

/**
 * Indikator loading tiga kotak yang lompat bergantian berurutan.
 * Selalu sertakan label agar terbaca screen reader (role="status").
 */
export function Loader({
  label = "Memuat…",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <span role="status" className="inline-flex items-center gap-3">
      <span className="inline-flex items-end gap-1.5" aria-hidden="true">
        {COLORS.map((c, i) => (
          <span
            key={c}
            className={`loader-box ${compact ? "loader-box-sm" : ""} ${c}`}
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
      {!compact && (
        <span className="font-mono text-xs font-bold tracking-widest uppercase">
          {label}
        </span>
      )}
    </span>
  );
}
