import { fail, isBlank, ok, type ParseResult } from "@/lib/result/parse-result"

const PLAIN_DECIMAL = /^-?\d+(?:[.,]\d+)?$/

/**
 * Mengubah nilai sel menjadi angka. Mendukung titik atau koma desimal.
 *
 * - Sel kosong dan "-" menjadi `null` (bukan nol).
 * - Teks yang memuat titik dan koma sekaligus (mis. "1,234.5") ditolak karena
 *   ambigu antara pemisah ribuan dan desimal.
 */
export function parseDecimal(raw: unknown): ParseResult<number | null> {
  if (isBlank(raw)) return ok(null)

  if (typeof raw === "number") {
    return Number.isFinite(raw) ? ok(raw) : fail("angka tidak valid")
  }

  if (typeof raw !== "string") return fail("bukan angka")

  const text = raw.trim().replace(/\s+/g, "")
  if (text === "-") return ok(null)

  if (text.includes(".") && text.includes(",")) {
    return fail("format angka ambigu (memuat titik dan koma)")
  }
  if (!PLAIN_DECIMAL.test(text)) return fail("bukan angka")

  return ok(Number(text.replace(",", ".")))
}
