import { DAYS_PER_MONTH } from "./constants"

const MS_PER_DAY = 86_400_000

function toUtcMs(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number)
  return Date.UTC(year, month - 1, day)
}

/**
 * Umur dalam hari kalender penuh antara dua tanggal ISO (`YYYY-MM-DD`). Dihitung dalam UTC
 * sehingga tidak bergeser oleh zona waktu atau perubahan jam musim panas. Null jika
 * tanggal ukur lebih awal dari tanggal lahir.
 */
export function ageInDays(
  birthDate: string,
  measuredAt: string
): number | null {
  const days = Math.round(
    (toUtcMs(measuredAt) - toUtcMs(birthDate)) / MS_PER_DAY
  )
  return days < 0 ? null : days
}

/** Umur dalam bulan (tidak dibulatkan) = hari / 30,4375. Dipakai untuk batas 60 dan 9 bulan. */
export function ageInMonthsExact(days: number): number {
  return days / DAYS_PER_MONTH
}
