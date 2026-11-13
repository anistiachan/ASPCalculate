import type { AnthropometryResult } from "@/domain/anthropometry/compute"
import type { ReferenceSet } from "@/domain/anthropometry/references/reference"
import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"
import {
  buildStatusLists,
  buildTargetLists,
  type StatusLists,
  type TargetLists,
} from "@/domain/reporting/lists"
import { monthKeyOf, type MonthKey } from "@/domain/reporting/monthly-recap"
import { buildRecheckList, type RecheckEntry } from "@/domain/reporting/recheck"
import { computeNutritionResults } from "@/features/children/services/nutrition-results"

export type MonthLists = {
  status: StatusLists
  targets: TargetLists
  /** Ukuran yang perlu diukur ulang atau dicek ke orang yang bersangkutan. */
  recheck: RecheckEntry[]
}

/** Daftar keluaran satu bulan. Status gizi hanya dihitung untuk pengukuran bulan itu. */
export function computeListsForMonth(
  month: MonthKey,
  children: readonly StoredChild[],
  measurements: readonly StoredMeasurement[],
  refs: ReferenceSet
): MonthLists {
  const childById = new Map(children.map((child) => [child.id, child]))
  const results = new Map<string, AnthropometryResult>()
  for (const measurement of measurements) {
    if (monthKeyOf(measurement.measuredAt) !== month) continue
    const child = childById.get(measurement.childId)
    if (!child) continue
    const [row] = computeNutritionResults(child, [measurement], refs)
    results.set(measurement.id, row.result)
  }
  return {
    status: buildStatusLists(month, children, measurements, results),
    targets: buildTargetLists(month, children, measurements),
    recheck: buildRecheckList(month, children, measurements, results),
  }
}
