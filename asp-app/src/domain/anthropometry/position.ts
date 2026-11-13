import type { MeasurementPosition } from "@/domain/child/child.types"

import { ageInMonthsExact } from "./age"
import {
  LENGTH_HEIGHT_SWITCH_DAYS,
  POSITION_CORRECTION_CM,
  STANDING_IMPLAUSIBLE_UNDER_MONTHS,
} from "./constants"

export type PositionFlag =
  | "POSITION_UNKNOWN"
  | "POSITION_CORRECTED_UP"
  | "POSITION_CORRECTED_DOWN"
  | "STANDING_UNDER_9_MONTHS"

export type StandardizedLengthHeight = {
  /** Nilai yang dipakai untuk perhitungan (sudah dikoreksi bila perlu). */
  cm: number
  /** +0,7, -0,7, atau 0. Nilai mentah tidak pernah ditimpa. */
  correctionCm: number
  flags: PositionFlag[]
  /** Posisi yang dianggap berlaku. `UNKNOWN` jika tidak tercatat atau tidak wajar. */
  effectivePosition: MeasurementPosition
}

/**
 * Menstandarkan panjang/tinggi agar berbasis panjang (telentang) untuk anak di bawah
 * 731 hari dan berbasis tinggi (berdiri) untuk selebihnya (Permenkes 2/2020; batas hari
 * dan perlakuan bayi < 9 bulan mengikuti WHO Anthro):
 *   - di bawah 731 hari diukur berdiri  → +0,7 cm
 *   - 731 hari ke atas diukur telentang → -0,7 cm
 *   - berdiri pada bayi < 9 bulan dianggap tidak wajar: diberi flag dan TIDAK dikoreksi
 *   - posisi tidak diketahui: tidak dikoreksi, diberi flag
 */
export function standardizeLengthHeight(args: {
  rawCm: number
  position: MeasurementPosition
  ageDays: number
}): StandardizedLengthHeight {
  const { rawCm, position, ageDays } = args
  const flags: PositionFlag[] = []

  if (position === "UNKNOWN") {
    flags.push("POSITION_UNKNOWN")
    return { cm: rawCm, correctionCm: 0, flags, effectivePosition: "UNKNOWN" }
  }

  if (
    position === "STANDING" &&
    ageInMonthsExact(ageDays) < STANDING_IMPLAUSIBLE_UNDER_MONTHS
  ) {
    flags.push("STANDING_UNDER_9_MONTHS")
    return { cm: rawCm, correctionCm: 0, flags, effectivePosition: "UNKNOWN" }
  }

  if (position === "STANDING" && ageDays < LENGTH_HEIGHT_SWITCH_DAYS) {
    flags.push("POSITION_CORRECTED_UP")
    return {
      cm: rawCm + POSITION_CORRECTION_CM,
      correctionCm: POSITION_CORRECTION_CM,
      flags,
      effectivePosition: position,
    }
  }

  if (position === "RECUMBENT" && ageDays >= LENGTH_HEIGHT_SWITCH_DAYS) {
    flags.push("POSITION_CORRECTED_DOWN")
    return {
      cm: rawCm - POSITION_CORRECTION_CM,
      correctionCm: -POSITION_CORRECTION_CM,
      flags,
      effectivePosition: position,
    }
  }

  return { cm: rawCm, correctionCm: 0, flags, effectivePosition: position }
}
