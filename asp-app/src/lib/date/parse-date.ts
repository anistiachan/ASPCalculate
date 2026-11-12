import { fail, isBlank, ok, type ParseResult } from "@/lib/result/parse-result"

const MIN_YEAR = 1900
const MAX_YEAR = 2100

// Serial tanggal Excel: hari sejak 1899-12-30 (sistem 1900, sudah memperhitungkan
// bug tahun kabisat 1900 untuk tanggal setelah 1 Maret 1900).
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)
const MS_PER_DAY = 86_400_000

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2})?.*)?$/
const DAY_FIRST_SLASH = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
const DAY_FIRST_DASH = /^(\d{1,2})-(\d{1,2})-(\d{4})$/

function toIsoDate(
  year: number,
  month: number,
  day: number
): ParseResult<string> {
  if (year < MIN_YEAR || year > MAX_YEAR)
    return fail("tahun di luar rentang wajar")

  // Date.UTC menggulung tanggal tidak valid (31 Februari → Maret), jadi cocokkan balik.
  const date = new Date(Date.UTC(year, month - 1, day))
  const isRealDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  if (!isRealDate) return fail("tanggal tidak ada di kalender")

  const mm = String(month).padStart(2, "0")
  const dd = String(day).padStart(2, "0")
  return ok(`${year}-${mm}-${dd}`)
}

/**
 * Mengubah nilai sel menjadi tanggal `YYYY-MM-DD`.
 *
 * Format teks dibaca dengan pola eksplisit (hari lebih dulu untuk `DD/MM/YYYY`
 * dan `DD-MM-YYYY`), tidak memakai parser bebas yang bisa menukar hari dan bulan.
 * Angka dibaca sebagai serial tanggal Excel dan dihitung dalam UTC supaya tidak
 * bergantung pada zona waktu perangkat.
 */
export function parseDate(raw: unknown): ParseResult<string | null> {
  if (isBlank(raw)) return ok(null)

  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 1)
      return fail("serial tanggal tidak valid")
    const date = new Date(EXCEL_EPOCH_UTC + Math.floor(raw) * MS_PER_DAY)
    return toIsoDate(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate()
    )
  }

  if (typeof raw !== "string") return fail("format tanggal tidak dikenal")

  const text = raw.trim()

  const iso = ISO_DATE.exec(text)
  if (iso) return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  const dayFirst = DAY_FIRST_SLASH.exec(text) ?? DAY_FIRST_DASH.exec(text)
  if (dayFirst) {
    return toIsoDate(
      Number(dayFirst[3]),
      Number(dayFirst[2]),
      Number(dayFirst[1])
    )
  }

  return fail("format tanggal tidak dikenal")
}
