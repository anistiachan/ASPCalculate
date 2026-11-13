import type { StoredMeasurement } from "@/domain/child/stored.types"

/**
 * Tahun yang bisa dipilih di laporan: dari tahun pengukuran tertua sampai tahun ini, urut
 * turun. Tanpa pengukuran, hanya tahun ini.
 */
export function yearOptions(
  measurements: readonly Pick<StoredMeasurement, "measuredAt">[],
  today: string
): number[] {
  const currentYear = Number(today.slice(0, 4))
  const oldest = measurements.reduce(
    (min, m) => Math.min(min, Number(m.measuredAt.slice(0, 4))),
    currentYear
  )
  return Array.from(
    { length: currentYear - oldest + 1 },
    (_, i) => currentYear - i
  )
}
