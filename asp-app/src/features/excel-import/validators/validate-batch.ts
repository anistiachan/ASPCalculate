import { checkPlausibility } from "@/domain/measurement/plausibility"

import type {
  ImportedChild,
  ImportedMeasurement,
  ImportBatch,
  ImportIssue,
} from "../types"

export type ValidatedBatch = {
  adapterId: string
  fileName: string
  /** Hanya anak yang identitasnya jelas (NIK tidak ganda). */
  children: ImportedChild[]
  /** Hanya pengukuran tanpa error dan terhubung ke satu anak. */
  measurements: ImportedMeasurement[]
  /** Semua masalah: dari parsing dan dari validasi lintas baris. */
  issues: ImportIssue[]
  skippedSheets: ImportBatch["skippedSheets"]
  sheetSummaries: ImportBatch["sheetSummaries"]
  counts: {
    errors: number
    warnings: number
    /** Baris pengukuran yang tidak bisa diimpor karena error. */
    measurementsRejected: number
  }
}

const normalizeName = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, " ")

/**
 * Validasi lintas baris dan lintas sheet: pencocokan pengukuran ke data induk,
 * konflik identitas, tanggal, dan duplikasi. Tidak ada data yang dihapus atau
 * ditimpa diam-diam; setiap penolakan dan konflik dicatat sebagai masalah.
 */
export function validateBatch(batch: ImportBatch): ValidatedBatch {
  const issues: ImportIssue[] = [...batch.issues]

  // 1. Data induk: NIK ganda membuat identitas ambigu, jadi semua barisnya ditolak.
  const byKey = new Map<string, ImportedChild[]>()
  for (const child of batch.children) {
    const group = byKey.get(child.sourceKey) ?? []
    group.push(child)
    byKey.set(child.sourceKey, group)
  }

  const children: ImportedChild[] = []
  for (const group of byKey.values()) {
    if (group.length === 1) {
      children.push(group[0])
      continue
    }
    for (const child of group) {
      issues.push({
        severity: "error",
        code: "CHILD_DUPLICATE_KEY",
        message:
          "Kunci anak (NIK atau nama + tanggal lahir + Posyandu) muncul lebih dari sekali; identitas anak ambigu.",
        sheet: child.source.sheet,
        row: child.source.row,
        field: "nik",
      })
    }
  }
  const childByKey = new Map(children.map((child) => [child.sourceKey, child]))

  // 2. Pengukuran: cocokkan ke data induk lalu periksa konsistensi.
  const measurements: ImportedMeasurement[] = []
  const seenMeasurementKeys = new Set<string>()
  let measurementsRejected = 0

  for (const measurement of batch.measurements) {
    const { sheet, row } = measurement.source
    const child = childByKey.get(measurement.sourceChildKey)

    if (!child) {
      issues.push({
        severity: "error",
        code: "CHILD_NOT_FOUND",
        message:
          "Kunci anak tidak ditemukan pada data induk (atau ambigu); pengukuran tidak diimpor.",
        sheet,
        row,
        field: "nik",
      })
      measurementsRejected++
      continue
    }

    let rejected = false
    const reject = (
      code: ImportIssue["code"],
      message: string,
      field?: string
    ) => {
      rejected = true
      issues.push({ severity: "error", code, message, sheet, row, field })
    }

    if (measurement.measuredAt < child.birthDate) {
      reject(
        "MEASURED_BEFORE_BIRTH",
        "Tanggal ukur lebih awal dari tanggal lahir.",
        "measuredAt"
      )
    }
    if (measurement.weightKg !== null && measurement.weightKg <= 0) {
      reject(
        "NON_POSITIVE_MEASUREMENT",
        "Berat harus lebih dari nol.",
        "weightKg"
      )
    }
    if (
      measurement.rawLengthHeightCm !== null &&
      measurement.rawLengthHeightCm <= 0
    ) {
      reject(
        "NON_POSITIVE_MEASUREMENT",
        "Tinggi/panjang harus lebih dari nol.",
        "heightCm"
      )
    }

    // Nilai di luar rentang wajar (mis. TB 814 cm, seharusnya 81,4) hanya diberi peringatan:
    // bisa jadi salah ketik, tetapi tidak ditolak dan tidak diubah. Nol/negatif sudah ditolak di atas.
    const plausibility = checkPlausibility({
      weightKg:
        measurement.weightKg !== null && measurement.weightKg > 0
          ? measurement.weightKg
          : null,
      heightCm:
        measurement.rawLengthHeightCm !== null &&
        measurement.rawLengthHeightCm > 0
          ? measurement.rawLengthHeightCm
          : null,
    })
    for (const warning of plausibility) {
      issues.push({
        severity: "warning",
        code: "INVALID_VALUE",
        message: warning.message,
        sheet,
        row,
        field: warning.field === "weightKg" ? "weightKg" : "heightCm",
      })
    }

    // Konflik identitas hanya peringatan; data induk dipakai sebagai sumber utama.
    if (
      measurement.sourceChildName !== "" &&
      normalizeName(measurement.sourceChildName) !== normalizeName(child.name)
    ) {
      issues.push({
        severity: "warning",
        code: "NAME_MISMATCH",
        message: "Nama anak berbeda dengan data induk; data induk dipakai.",
        sheet,
        row,
        field: "name",
      })
    }
    if (
      measurement.birthDateFromSheet !== null &&
      measurement.birthDateFromSheet !== child.birthDate
    ) {
      issues.push({
        severity: "warning",
        code: "BIRTH_DATE_MISMATCH",
        message: "Tanggal lahir berbeda dengan data induk; data induk dipakai.",
        sheet,
        row,
        field: "birthDate",
      })
    }

    // Duplikat dicatat, tidak dihapus: pengguna yang memutuskan.
    const measurementKey = `${measurement.sourceChildKey}|${measurement.measuredAt}`
    if (seenMeasurementKeys.has(measurementKey)) {
      issues.push({
        severity: "warning",
        code: "DUPLICATE_MEASUREMENT",
        message: "Ada pengukuran lain untuk anak dan tanggal ukur yang sama.",
        sheet,
        row,
      })
    }
    seenMeasurementKeys.add(measurementKey)

    if (rejected) {
      measurementsRejected++
      continue
    }
    measurements.push(measurement)
  }

  return {
    adapterId: batch.adapterId,
    fileName: batch.fileName,
    children,
    measurements,
    issues,
    skippedSheets: batch.skippedSheets,
    sheetSummaries: batch.sheetSummaries,
    counts: {
      errors: issues.filter((issue) => issue.severity === "error").length,
      warnings: issues.filter((issue) => issue.severity === "warning").length,
      measurementsRejected,
    },
  }
}
