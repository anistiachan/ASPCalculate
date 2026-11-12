/**
 * Format tampilan berbahasa Indonesia. Tanggal ISO dibaca sebagai tanggal kalender
 * (UTC) sehingga tidak bergeser karena zona waktu perangkat.
 */

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

const shortDateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

const numberFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
})

function isoToUtcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

/** `2025-03-15` → `15 Maret 2025`. */
export function formatDate(iso: string): string {
  return dateFormatter.format(isoToUtcDate(iso))
}

/** `2025-03-15` → `15 Mar 2025`. */
export function formatShortDate(iso: string): string {
  return shortDateFormatter.format(isoToUtcDate(iso))
}

/** `11.2` → `11,2`. Null ditampilkan sebagai tanda strip, bukan nol. */
export function formatNumber(value: number | null): string {
  return value === null ? "–" : numberFormatter.format(value)
}

/** Umur bulan penuh untuk tampilan; null → strip. */
export function formatAgeMonths(months: number | null): string {
  if (months === null) return "–"
  if (months < 24) return `${months} bln`
  const years = Math.floor(months / 12)
  const rest = months % 12
  return rest === 0 ? `${years} th` : `${years} th ${rest} bln`
}
