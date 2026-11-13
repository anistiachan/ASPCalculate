import type { AnthropometryResult } from "@/domain/anthropometry/compute"
import type { ReferenceSet } from "@/domain/anthropometry/references/reference"
import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"
import {
  buildMonthlyRecap,
  monthKeyOf,
  type MonthKey,
  type MonthlyRecap,
} from "@/domain/reporting/monthly-recap"

import { computeNutritionResults } from "@/features/children/services/nutrition-results"

/**
 * Rekap satu bulan lengkap dengan status gizi. Status gizi hanya dihitung untuk
 * pengukuran pada bulan itu (bukan seluruh riwayat), jadi biayanya tetap kecil walau
 * datanya bertahun-tahun.
 */
export function computeRecapForMonth(
  month: MonthKey,
  children: readonly StoredChild[],
  measurements: readonly StoredMeasurement[],
  refs: ReferenceSet
): MonthlyRecap {
  const childById = new Map(children.map((child) => [child.id, child]))
  const results = new Map<string, AnthropometryResult>()

  for (const measurement of measurements) {
    if (monthKeyOf(measurement.measuredAt) !== month) continue
    const child = childById.get(measurement.childId)
    if (!child) continue
    const [row] = computeNutritionResults(child, [measurement], refs)
    results.set(measurement.id, row.result)
  }

  return buildMonthlyRecap(month, children, measurements, results)
}
