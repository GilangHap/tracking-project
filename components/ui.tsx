import type { ProjectStatus } from "@/lib/types";

export const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** Tombol kontrol jendela ala retro (dekoratif). */
export function WinControls({ dark = false }: { dark?: boolean }) {
  const box = dark ? "border-white/40 text-white" : "border-ink text-ink";
  return (
    <div aria-hidden="true" className="flex shrink-0 items-center gap-1">
      <span
        className={`grid h-5 w-5 place-items-center border-2 ${box} bg-transparent font-mono text-[10px] leading-none`}
      >
        –
      </span>
      <span
        className={`grid h-5 w-5 place-items-center border-2 ${box} bg-transparent font-mono text-[10px] leading-none`}
      >
        ▢
      </span>
      <span className="grid h-5 w-5 place-items-center border-2 border-ink bg-bubblegum font-mono text-[10px] leading-none text-ink">
        ✕
      </span>
    </div>
  );
}

/** Jendela retro: title bar berwarna + kontrol + badan paper. */
export function Window({
  title,
  bar = "bg-sky",
  controls = true,
  children,
  className = "",
  bare = false,
}: {
  title: string;
  bar?: string;
  controls?: boolean;
  children: React.ReactNode;
  className?: string;
  bare?: boolean;
}) {
  return (
    <section
      className={`border-2 border-ink bg-paper shadow-brutal ${className}`}
    >
      <div
        className={`flex items-center justify-between gap-2 border-b-2 border-ink px-3 py-1.5 ${bar}`}
      >
        <p className="truncate font-mono text-xs font-bold tracking-widest uppercase">
          {title}
        </p>
        {controls && <WinControls />}
      </div>
      {bare ? children : <div className="p-4 md:p-5">{children}</div>}
    </section>
  );
}

/** Bar section full-width ala TERLARIS_DI_MASTUMBAS. */
export function SectionBar({
  title,
  bar = "bg-butter",
  action,
}: {
  title: string;
  bar?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 border-2 border-ink px-3 py-1.5 shadow-brutal-sm ${bar}`}
    >
      <h2 className="truncate font-mono text-sm font-bold tracking-widest uppercase">
        {title}
      </h2>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        <WinControls />
      </div>
    </div>
  );
}

export function Btn({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "paper" | "dark" | "danger";
}) {
  const styles = {
    // primary (butter): warna tetap, feedback = lift + press — seperti CTA aslinya.
    primary: "press lift bg-butter text-ink",
    paper: "press bg-paper text-ink hover:bg-lavender",
    dark: "press lift bg-ink text-white",
    danger: "press bg-paper text-danger hover:bg-dangersoft/60",
  } as const;
  return (
    <button
      className={`press min-h-11 cursor-pointer rounded border-2 border-ink px-5 py-2.5 font-mono text-sm font-bold tracking-wider uppercase shadow-brutal-sm ${FOCUS} ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Chip({
  children,
  tint = "bg-paper",
}: {
  children: React.ReactNode;
  tint?: string;
}) {
  return (
    <span
      className={`inline-block rounded border-2 border-ink px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider uppercase ${tint}`}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block font-mono text-xs font-bold tracking-widest uppercase">
      {label}
      {children}
      {hint && (
        <span className="mt-1 block font-body text-xs font-normal normal-case tracking-normal text-inksoft">
          {hint}
        </span>
      )}
    </label>
  );
}

export const inputCls = `mt-1 w-full rounded border-2 border-ink bg-paper px-4 py-2.5 text-base text-ink shadow-brutal-sm placeholder:text-inkfaint ${FOCUS}`;

export function StatusBadge({ status }: { status: ProjectStatus | string }) {
  const styles: Record<string, string> = {
    Ongoing: "bg-mint text-success",
    Completed: "bg-lavender/70 text-ink",
    "Not Started": "bg-paper text-inksoft",
    Archived: "bg-paperdim text-inkfaint",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border-2 border-ink px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider whitespace-nowrap uppercase ${styles[status] ?? styles["Not Started"]}`}
    >
      {status === "Ongoing" && (
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full bg-success motion-safe:animate-pulse"
        />
      )}
      {status}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  tint = "bg-paper",
}: {
  label: string;
  value: string;
  sub?: string;
  tint?: string;
}) {
  return (
    <div className="border-2 border-ink bg-paper shadow-brutal-sm">
      <p
        className={`border-b-2 border-ink px-3 py-1 font-mono text-[11px] font-bold tracking-widest uppercase ${tint}`}
      >
        {label}
      </p>
      <p className="px-3 py-2 font-mono text-2xl font-bold tabular-nums md:text-3xl">
        {value}
      </p>
      {sub && (
        <p className="truncate px-3 pb-2 font-mono text-[11px] text-inksoft">
          {sub}
        </p>
      )}
    </div>
  );
}

export function EmptyRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-inksoft">
        {children}
      </td>
    </tr>
  );
}
