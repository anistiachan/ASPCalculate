import type { MeasurementPosition, Sex } from "@/domain/child/child.types"

import { ageInDays, ageInMonthsExact } from "./age"
import {
  classifyHeightForAge,
  classifyNutritionalStatus,
  classifyWeightForAge,
  type HeightForAgeCategory,
  type NutritionalStatusCategory,
  type WeightForAgeCategory,
} from "./classification"
import {
  ALGORITHM_VERSION,
  IMPLAUSIBLE_RANGES,
  LENGTH_HEIGHT_SWITCH_DAYS,
  MAX_AGE_MONTHS_EXCLUSIVE,
  MAX_TABLE_AGE_DAYS,
  STANDARD_NAME,
  WFH_RANGE_CM,
  WFL_RANGE_CM,
} from "./constants"
import { lmsZScore, lmsZScoreAdjusted, roundZScore, type Lms } from "./lms"
import { standardizeLengthHeight, type PositionFlag } from "./position"
import {
  describeReferenceVersion,
  lookupByAgeDays,
  lookupByLengthHeight,
  type ReferenceSet,
} from "./references/reference"

/**
 * Kondisi edema pitting. `UNMAPPED` = ada isian di sumber tetapi kamus kodenya belum
 * dikonfirmasi, jadi tidak ditafsirkan. `PRESENT` menonaktifkan z-score berbasis berat,
 * sama seperti WHO Anthro. Kosong dianggap tidak ada edema (default WHO).
 */
export type PittingEdema = "NONE" | "PRESENT" | "UNMAPPED"

export type AnthropometryInput = {
  sex: Sex
  /** YYYY-MM-DD */
  birthDate: string
  /** YYYY-MM-DD */
  measuredAt: string
  weightKg: number | null
  /** Panjang/tinggi mentah sesuai posisi ukur, belum dikoreksi. */
  rawLengthHeightCm: number | null
  position: MeasurementPosition
  pittingEdema: PittingEdema
}

export type AnthropometryFlag =
  | PositionFlag
  | "AGE_INVALID"
  | "AGE_OUT_OF_RANGE"
  | "WEIGHT_MISSING"
  | "HEIGHT_MISSING"
  | "WFH_OUT_OF_RANGE"
  | "IMPLAUSIBLE_WAZ"
  | "IMPLAUSIBLE_HAZ"
  | "IMPLAUSIBLE_WHZ"
  | "IMPLAUSIBLE_BAZ"
  | "PITTING_EDEMA_PRESENT"
  | "PITTING_EDEMA_UNMAPPED"

export type AnthropometryResult = {
  sex: Sex
  ageInDays: number | null
  /** Umur tidak dibulatkan: hari / 30,4375. */
  ageInMonthsExact: number | null

  weightKg: number | null
  rawLengthHeightCm: number | null
  measurementPosition: MeasurementPosition
  correctedLengthHeightCm: number | null
  correctionCm: number
  bmi: number | null

  /** Z-score dibulatkan 2 desimal. Null = tidak dapat dihitung (lihat `flags`). */
  waz: number | null
  haz: number | null
  whz: number | null
  baz: number | null

  wazCategory: WeightForAgeCategory | null
  hazCategory: HeightForAgeCategory | null
  whzCategory: NutritionalStatusCategory | null
  bazCategory: NutritionalStatusCategory | null

  /** Tabel yang dipakai untuk BB/PB-TB: panjang (< 731 hari) atau tinggi. */
  whzTable: "WFL" | "WFH" | null

  flags: AnthropometryFlag[]
  standardName: string
  referenceDataVersion: string
  algorithmVersion: string
}

const isPositive = (value: number | null): value is number =>
  value !== null && Number.isFinite(value) && value > 0

const outside = (z: number, range: { min: number; max: number }) =>
  z < range.min || z > range.max

/**
 * Menghitung z-score dan kategori status gizi satu pengukuran. Fungsi murni: seluruh
 * tabel referensi diberikan sebagai argumen. Alurnya mengikuti WHO Anthro:
 * umur → standardisasi panjang/tinggi → BMI → z-score tiap indikator → flag → klasifikasi.
 *
 * Nilai yang tidak dapat dihitung menjadi `null` disertai flag penyebabnya, bukan nol.
 */
export function computeAnthropometry(
  input: AnthropometryInput,
  refs: ReferenceSet
): AnthropometryResult {
  const flags: AnthropometryFlag[] = []
  const days = ageInDays(input.birthDate, input.measuredAt)

  const result: AnthropometryResult = {
    sex: input.sex,
    ageInDays: days,
    ageInMonthsExact: days === null ? null : ageInMonthsExact(days),
    weightKg: isPositive(input.weightKg) ? input.weightKg : null,
    rawLengthHeightCm: isPositive(input.rawLengthHeightCm)
      ? input.rawLengthHeightCm
      : null,
    measurementPosition: input.position,
    correctedLengthHeightCm: null,
    correctionCm: 0,
    bmi: null,
    waz: null,
    haz: null,
    whz: null,
    baz: null,
    wazCategory: null,
    hazCategory: null,
    whzCategory: null,
    bazCategory: null,
    whzTable: null,
    flags,
    standardName: STANDARD_NAME,
    referenceDataVersion: describeReferenceVersion(refs.metadata),
    algorithmVersion: ALGORITHM_VERSION,
  }

  if (days === null) {
    flags.push("AGE_INVALID")
    return result
  }
  // WHO Anthro: z-score hanya untuk umur < 60 bulan (tidak dibulatkan) dan dalam rentang tabel.
  if (
    result.ageInMonthsExact! >= MAX_AGE_MONTHS_EXCLUSIVE ||
    days > MAX_TABLE_AGE_DAYS
  ) {
    flags.push("AGE_OUT_OF_RANGE")
    return result
  }

  if (result.weightKg === null) flags.push("WEIGHT_MISSING")
  if (result.rawLengthHeightCm === null) flags.push("HEIGHT_MISSING")

  // Edema: z-score berbasis berat tidak dihitung bila ada (WHO Anthro).
  const weightBasedAllowed = input.pittingEdema !== "PRESENT"
  if (input.pittingEdema === "PRESENT") flags.push("PITTING_EDEMA_PRESENT")
  if (input.pittingEdema === "UNMAPPED") flags.push("PITTING_EDEMA_UNMAPPED")

  // Panjang/tinggi distandarkan dulu; dipakai untuk TB/U, BB/PB-TB, dan IMT.
  let height: number | null = null
  if (result.rawLengthHeightCm !== null) {
    const standardized = standardizeLengthHeight({
      rawCm: result.rawLengthHeightCm,
      position: input.position,
      ageDays: days,
    })
    height = standardized.cm
    result.correctedLengthHeightCm = standardized.cm
    result.correctionCm = standardized.correctionCm
    flags.push(...standardized.flags)
  }

  if (result.weightKg !== null && height !== null) {
    result.bmi = result.weightKg / Math.pow(height / 100, 2)
  }

  // Penyesuaian di luar ±3 SD hanya untuk indikator berbasis berat.
  const zAdjusted = (y: number, lms: Lms | null) =>
    lms ? roundZScore(lmsZScoreAdjusted(y, lms)) : null

  // BB/U
  if (result.weightKg !== null && weightBasedAllowed) {
    result.waz = zAdjusted(
      result.weightKg,
      lookupByAgeDays(refs.wfa, input.sex, days)
    )
  }

  // TB/U: rumus LMS biasa (tanpa penyesuaian).
  if (height !== null) {
    const lms = lookupByAgeDays(refs.lhfa, input.sex, days)
    result.haz = lms ? roundZScore(lmsZScore(height, lms)) : null
  }

  // IMT/U
  if (result.bmi !== null && weightBasedAllowed) {
    result.baz = zAdjusted(
      result.bmi,
      lookupByAgeDays(refs.bfa, input.sex, days)
    )
  }

  // BB/PB (< 731 hari) atau BB/TB (selebihnya), dengan interpolasi menurut tinggi.
  if (result.weightKg !== null && height !== null && weightBasedAllowed) {
    const useLength = days < LENGTH_HEIGHT_SWITCH_DAYS
    const range = useLength ? WFL_RANGE_CM : WFH_RANGE_CM
    result.whzTable = useLength ? "WFL" : "WFH"

    if (height >= range.min && height <= range.max) {
      const table = useLength ? refs.wfl : refs.wfh
      result.whz = zAdjusted(
        result.weightKg,
        lookupByLengthHeight(table, input.sex, height)
      )
    } else {
      flags.push("WFH_OUT_OF_RANGE")
    }
  }

  // Flag nilai tidak wajar (nilai tetap ditampilkan; hanya untuk diperiksa ulang).
  if (result.waz !== null && outside(result.waz, IMPLAUSIBLE_RANGES.waz))
    flags.push("IMPLAUSIBLE_WAZ")
  if (result.haz !== null && outside(result.haz, IMPLAUSIBLE_RANGES.haz))
    flags.push("IMPLAUSIBLE_HAZ")
  if (result.whz !== null && outside(result.whz, IMPLAUSIBLE_RANGES.whz))
    flags.push("IMPLAUSIBLE_WHZ")
  if (result.baz !== null && outside(result.baz, IMPLAUSIBLE_RANGES.baz))
    flags.push("IMPLAUSIBLE_BAZ")

  // Klasifikasi memakai z-score yang sudah dibulatkan, seperti keluaran WHO Anthro.
  if (result.waz !== null) result.wazCategory = classifyWeightForAge(result.waz)
  if (result.haz !== null) result.hazCategory = classifyHeightForAge(result.haz)
  if (result.whz !== null)
    result.whzCategory = classifyNutritionalStatus(result.whz)
  if (result.baz !== null)
    result.bazCategory = classifyNutritionalStatus(result.baz)

  return result
}
