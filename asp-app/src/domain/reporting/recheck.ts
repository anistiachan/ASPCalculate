import type { AnthropometryResult } from "@/domain/anthropometry/compute"
import type { Sex } from "@/domain/child/child.types"
import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"
import { checkPlausibility } from "@/domain/measurement/plausibility"

import {
  indexMeasurementsByChild,
  isEligibleInMonth,
  monthKeyOf,
  type MonthKey,
} from "./monthly-recap"

/*
 * Daftar ukuran yang perlu DIUKUR ULANG atau dicek ke orang yang bersangkutan.
 *
 * Ini pemeriksaan kualitas data: setiap penanda hanya mengajak petugas memverifikasi, tidak
 * pernah mengubah, menghapus, atau "memperbaiki" angka. Angka baru hanya boleh berasal dari
 * hasil ukur ulang nyata. Ambang di bawah bersifat sementara, perlu dikonfirmasi tenaga gizi.
 */

/** Penurunan tinggi/panjang (cm) di atas ini dianggap janggal; kesalahan ukur biasa ±1 cm. */
export const HEIGHT_DROP_CM = 1
/** Penurunan berat (kg) di atas ini dari pengukuran sebelumnya perlu dicek. */
export const WEIGHT_DROP_KG = 1

/** Batas z-score tak masuk akal secara biologis menurut WHO (di luar ini dianggap salah ukur). */
export const IMPLAUSIBLE_Z = {
  haz: { min: -6, max: 6 },
  waz: { min: -6, max: 5 },
  whz: { min: -5, max: 5 },
} as const

export type RecheckReasonCode =
  | "DI_LUAR_RENTANG"
  | "Z_TAK_MASUK_AKAL"
  | "TINGGI_TURUN"
  | "BERAT_TURUN"
  /** Bukan kesalahan data: anak berstatus pendek/sangat pendek, diverifikasi dengan ukur ulang. */
  | "PENDEK"
  | "SANGAT_PENDEK"

const formatZ = (z: number | null) =>
  z === null ? "" : ` (z ${z.toFixed(2).replace(".", ",")})`

export type RecheckReason = { code: RecheckReasonCode; message: string }

export type RecheckEntry = {
  childId: string
  measurementId: string
  name: string
  sex: Sex
  posyandu: string | null
  measuredAt: string
  weightKg: number | null
  heightCm: number | null
  previousMeasuredAt: string | null
  previousWeightKg: number | null
  previousHeightCm: number | null
  reasons: RecheckReason[]
}

const outside = (
  value: number | null,
  range: { readonly min: number; readonly max: number }
) => value !== null && (value < range.min || value > range.max)

const byPosyanduThenName = (a: RecheckEntry, b: RecheckEntry) =>
  (a.posyandu ?? "").localeCompare(b.posyandu ?? "", "id") ||
  a.name.localeCompare(b.name, "id")

/**
 * Pengukuran terakhir tiap anak pada bulan itu yang punya penanda data janggal. Perbandingan
 * memakai pengukuran sebelumnya (sebelum tanggal itu) yang memuat nilai terkait.
 */
export function buildRecheckList(
  month: MonthKey,
  children: readonly StoredChild[],
  measurements: readonly StoredMeasurement[],
  resultsByMeasurementId: ReadonlyMap<string, AnthropometryResult>
): RecheckEntry[] {
  const byChild = indexMeasurementsByChild(measurements)
  const entries: RecheckEntry[] = []

  for (const child of children) {
    if (!isEligibleInMonth(child, month)) continue
    const history = [...(byChild.get(child.id) ?? [])].sort((a, b) =>
      a.measuredAt.localeCompare(b.measuredAt)
    )
    const current = history
      .filter(
        (m) =>
          monthKeyOf(m.measuredAt) === month &&
          (m.weightKg !== null || m.rawLengthHeightCm !== null)
      )
      .at(-1)
    if (!current) continue

    const earlier = history.filter((m) => m.measuredAt < current.measuredAt)
    const prevWeight = earlier.filter((m) => m.weightKg !== null).at(-1)
    const prevHeight = earlier
      .filter((m) => m.rawLengthHeightCm !== null)
      .at(-1)

    const reasons: RecheckReason[] = []

    for (const warning of checkPlausibility({
      weightKg: current.weightKg,
      heightCm: current.rawLengthHeightCm,
    })) {
      reasons.push({ code: "DI_LUAR_RENTANG", message: warning.message })
    }

    const result = resultsByMeasurementId.get(current.id)
    if (
      result &&
      (outside(result.haz, IMPLAUSIBLE_Z.haz) ||
        outside(result.waz, IMPLAUSIBLE_Z.waz) ||
        outside(result.whz, IMPLAUSIBLE_Z.whz))
    ) {
      reasons.push({
        code: "Z_TAK_MASUK_AKAL",
        message:
          "Hasil z-score di luar batas yang masuk akal secara biologis (kemungkinan salah ukur atau salah catat).",
      })
    }

    if (result?.hazCategory === "SANGAT_PENDEK") {
      reasons.push({
        code: "SANGAT_PENDEK",
        message: `TB/U sangat pendek${formatZ(result.haz)}. Ukur ulang untuk memastikan; angka asli tidak diubah.`,
      })
    } else if (result?.hazCategory === "PENDEK") {
      reasons.push({
        code: "PENDEK",
        message: `TB/U pendek${formatZ(result.haz)}. Ukur ulang untuk memastikan; angka asli tidak diubah.`,
      })
    }

    if (
      current.rawLengthHeightCm !== null &&
      prevHeight?.rawLengthHeightCm != null &&
      prevHeight.rawLengthHeightCm - current.rawLengthHeightCm > HEIGHT_DROP_CM
    ) {
      reasons.push({
        code: "TINGGI_TURUN",
        message: `Tinggi turun dari ${prevHeight.rawLengthHeightCm} cm (${prevHeight.measuredAt}) menjadi ${current.rawLengthHeightCm} cm.`,
      })
    }

    if (
      current.weightKg !== null &&
      prevWeight?.weightKg != null &&
      prevWeight.weightKg - current.weightKg > WEIGHT_DROP_KG
    ) {
      reasons.push({
        code: "BERAT_TURUN",
        message: `Berat turun dari ${prevWeight.weightKg} kg (${prevWeight.measuredAt}) menjadi ${current.weightKg} kg.`,
      })
    }

    if (reasons.length === 0) continue

    entries.push({
      childId: child.id,
      measurementId: current.id,
      name: child.name,
      sex: child.sex,
      posyandu: child.posyandu ?? null,
      measuredAt: current.measuredAt,
      weightKg: current.weightKg,
      heightCm: current.rawLengthHeightCm,
      previousMeasuredAt: (prevHeight ?? prevWeight)?.measuredAt ?? null,
      previousWeightKg: prevWeight?.weightKg ?? null,
      previousHeightCm: prevHeight?.rawLengthHeightCm ?? null,
      reasons,
    })
  }

  return entries.sort(byPosyanduThenName)
}
