import { fail, isBlank, ok, type ParseResult } from "@/lib/result/parse-result"

/** "ya" → true, "tidak" → false, kosong → null. Kosong tidak pernah dianggap false. */
export function parseYesNo(raw: unknown): ParseResult<boolean | null> {
  if (isBlank(raw)) return ok(null)

  const text = String(raw).trim().toLowerCase()
  if (text === "ya") return ok(true)
  if (text === "tidak") return ok(false)
  return fail("nilai bukan ya/tidak")
}
