import {
  computeAnthropometry,
  type AnthropometryResult,
  type PittingEdema,
} from "@/domain/anthropometry/compute"
import type { ReferenceSet } from "@/domain/anthropometry/references/reference"
import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"

export type MeasurementNutrition = {
  measurement: StoredMeasurement
  result: AnthropometryResult
}

/**
 * Kamus kode edema pitting belum dikonfirmasi pemilik format (mapping Bu Bidan, bagian 6.5),
 * jadi isian tidak ditafsirkan: kosong = tidak tercatat (dianggap tidak ada edema, default WHO),
 * terisi = `UNMAPPED` yang hanya memberi flag.
 */
export function toPittingEdema(raw: string | null): PittingEdema {
  return raw === null || raw.trim() === "" ? "NONE" : "UNMAPPED"
}

/** Menghitung status gizi tiap pengukuran seorang anak; urutan masukan dipertahankan. */
export function computeNutritionResults(
  child: StoredChild,
  measurements: readonly StoredMeasurement[],
  refs: ReferenceSet
): MeasurementNutrition[] {
  return measurements.map((measurement) => ({
    measurement,
    result: computeAnthropometry(
      {
        sex: child.sex,
        birthDate: child.birthDate,
        measuredAt: measurement.measuredAt,
        weightKg: measurement.weightKg,
        rawLengthHeightCm: measurement.rawLengthHeightCm,
        position: measurement.measurementPosition,
        pittingEdema: toPittingEdema(measurement.rawPittingEdema),
      },
      refs
    ),
  }))
}
