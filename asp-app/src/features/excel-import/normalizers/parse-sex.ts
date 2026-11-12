import type { Sex } from "@/domain/child/child.types"
import { fail, isBlank, ok, type ParseResult } from "@/lib/result/parse-result"

const MALE = new Set(["l", "lakilaki", "male", "m"])
const FEMALE = new Set(["p", "perempuan", "female", "f"])

/**
 * Hanya menerima nilai yang maknanya jelas. Kode numerik (mis. 1 dan 2 pada ekspor
 * ASP) sengaja ditolak karena pemetaannya belum dikonfirmasi pemilik format.
 */
export function parseSex(raw: unknown): ParseResult<Sex> {
  if (isBlank(raw)) return fail("jenis kelamin kosong")

  const text = String(raw)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "")

  if (MALE.has(text)) return ok("M")
  if (FEMALE.has(text)) return ok("F")
  if (/^\d+$/.test(text)) {
    return fail(
      "kode numerik jenis kelamin belum terkonfirmasi; gunakan L atau P"
    )
  }
  return fail("jenis kelamin tidak dikenali (gunakan L atau P)")
}
