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

const monthFormatter = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

const monthShortFormatter = new Intl.DateTimeFormat("id-ID", {
  month: "short",
  timeZone: "UTC",
})

const percentFormatter = new Intl.NumberFormat("id-ID", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

function isoToUtcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

/** `2026-06` → `Juni 2026`. */
export function formatMonth(month: string): string {
  return monthFormatter.format(isoToUtcDate(`${month}-01`))
}

/** `2026-06` → `Jun`. */
export function formatMonthShort(month: string): string {
  return monthShortFormatter.format(isoToUtcDate(`${month}-01`))
}

/**
 * `0.889` → `88,9%`. Penyebut nol menghasilkan strip, bukan "0%" atau "NaN": tidak ada
 * yang bisa dipersentasekan dari nol anak.
 */
export function formatPercent(numerator: number, denominator: number): string {
  return denominator === 0
    ? "–"
    : percentFormatter.format(numerator / denominator)
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

const zScoreFormatter = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
})

/** `0.24` → `+0,24`, `-6.09` → `-6,09`, `0` → `0,00`. Selalu 2 desimal; null → strip. */
export function formatZScore(z: number | null): string {
  return z === null ? "–" : zScoreFormatter.format(z)
}

/** Umur bulan penuh untuk tampilan; null → strip. */
export function formatAgeMonths(months: number | null): string {
  if (months === null) return "–"
  if (months < 24) return `${months} bln`
  const years = Math.floor(months / 12)
  const rest = months % 12
  return rest === 0 ? `${years} th` : `${years} th ${rest} bln`
}
