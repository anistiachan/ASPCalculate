import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"
import {
  indexMeasurementsByChild,
  type MonthKey,
} from "@/domain/reporting/monthly-recap"
import { buildSkdn, type SkdnMonthly } from "@/domain/reporting/skdn"

/** SKDN draf satu bulan dari seluruh riwayat penimbangan di perangkat. */
export function computeSkdnForMonth(
  month: MonthKey,
  children: readonly StoredChild[],
  measurements: readonly StoredMeasurement[]
): SkdnMonthly {
  return buildSkdn(month, children, indexMeasurementsByChild(measurements))
}
