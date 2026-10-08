/**
 * Escape karakter wildcard LIKE (% _ \) agar pencarian user
 * diperlakukan sebagai teks literal, bukan pola.
 */
export function escapeLike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
