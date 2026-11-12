import { fail, isBlank, ok, type ParseResult } from "@/lib/result/parse-result"

const NIK_PATTERN = /^\d{16}$/

/**
 * Membaca NIK sebagai teks 16 digit. NIK adalah data sensitif: pesan kegagalan
 * tidak boleh memuat nilainya.
 *
 * NIK yang tersimpan sebagai angka di Excel bisa kehilangan presisi (angka
 * Excel hanya akurat sampai 15 digit), jadi angka di luar rentang aman ditolak.
 */
export function parseNik(raw: unknown): ParseResult<string | null> {
  if (isBlank(raw)) return ok(null)

  let text: string
  if (typeof raw === "number") {
    if (!Number.isSafeInteger(raw)) {
      return fail(
        "NIK tersimpan sebagai angka dan kehilangan presisi; ubah kolom menjadi teks"
      )
    }
    text = String(raw)
  } else if (typeof raw === "string") {
    text = raw.trim().replace(/^'/, "").replace(/\s+/g, "")
  } else {
    return fail("format NIK tidak valid")
  }

  return NIK_PATTERN.test(text)
    ? ok(text)
    : fail("format NIK tidak valid (harus 16 digit)")
}
