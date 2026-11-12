import type { MeasurementPosition } from "@/domain/child/child.types"
import { isBlank } from "@/lib/result/parse-result"

export type ParsedPosition = {
  position: MeasurementPosition
  /** Teks asli dari sumber, disimpan untuk audit. */
  raw: string | null
  /** false jika sel terisi tetapi nilainya tidak dikenal. */
  recognized: boolean
}

export function parseMeasurementPosition(raw: unknown): ParsedPosition {
  if (isBlank(raw)) return { position: "UNKNOWN", raw: null, recognized: true }

  const rawText = String(raw).trim()
  const text = rawText.toLowerCase()

  if (text === "berdiri") {
    return { position: "STANDING", raw: rawText, recognized: true }
  }
  // "telentang" adalah ejaan lain yang umum dari "terlentang".
  if (text === "terlentang" || text === "telentang") {
    return { position: "RECUMBENT", raw: rawText, recognized: true }
  }
  return { position: "UNKNOWN", raw: rawText, recognized: false }
}
