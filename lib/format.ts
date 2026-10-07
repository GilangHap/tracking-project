const WIB = "Asia/Jakarta";

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: WIB,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const timeFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: WIB,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateTimeFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: WIB,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "07 Okt 2026" — input ISO UTC. */
export function fmtDateWIB(iso: string): string {
  return dateFmt.format(new Date(iso));
}

/** "08:30" — input ISO UTC. */
export function fmtTimeWIB(iso: string): string {
  return timeFmt.format(new Date(iso));
}

/** "07 Okt 2026, 08:30" — input ISO UTC. */
export function fmtDateTimeWIB(iso: string): string {
  return dateTimeFmt.format(new Date(iso));
}

/** detik → "6j 32m" / "45m" / "2j". */
export function fmtDuration(totalSecs: number): string {
  const s = Math.max(0, Math.floor(totalSecs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}j`;
  return `${h}j ${m}m`;
}

/**
 * ISO UTC → nilai input datetime-local dalam WIB ("2026-10-07T15:30").
 * Dipakai prefill form koreksi admin.
 */
export function toWIBInputValue(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Nilai datetime-local (diisi sebagai WIB) → ISO UTC untuk DB. */
export function wibInputToISO(local: string): string {
  return new Date(`${local}:00+07:00`).toISOString();
}
