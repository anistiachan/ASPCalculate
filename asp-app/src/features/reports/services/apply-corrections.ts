import {
  REMEASURED_NOTE_PREFIX,
  type CorrectionItem,
} from "@/domain/reporting/corrections"
import type { OpenAspDatabase } from "@/infrastructure/storage/db"
import {
  createMeasurement,
  getMeasurement,
} from "@/infrastructure/storage/repositories/child-repository"

export type ApplyCorrectionsResult = {
  saved: number
  failed: { rowNumber: number; name: string; message: string }[]
}

/** Catatan baris yang menyimpan jejak ukuran semula, supaya perubahan bisa ditelusuri. */
export function correctionNote(item: CorrectionItem): string {
  const { original } = item
  const was = [
    original.weightKg === null ? null : `BB ${original.weightKg} kg`,
    original.heightCm === null ? null : `TB ${original.heightCm} cm`,
  ]
    .filter(Boolean)
    .join(", ")
  return `${REMEASURED_NOTE_PREFIX}. Ukuran semula ${original.measuredAt}: ${was || "tidak ada angka"}.`
}

/**
 * Menyimpan hasil ukur ulang sebagai PENGUKURAN BARU pada tanggal ukur ulang. Pengukuran lama
 * tidak diubah atau dihapus. Satu baris yang gagal tidak membatalkan baris lainnya.
 */
export async function applyCorrections(
  db: OpenAspDatabase,
  items: readonly CorrectionItem[]
): Promise<ApplyCorrectionsResult> {
  const result: ApplyCorrectionsResult = { saved: 0, failed: [] }

  for (const item of items) {
    try {
      const original = await getMeasurement(db, item.originalMeasurementId)
      await createMeasurement(db, item.childId, {
        measuredAt: item.next.measuredAt,
        weightKg: item.next.weightKg,
        rawLengthHeightCm: item.next.heightCm,
        measurementPosition: original?.measurementPosition ?? "UNKNOWN",
        lilaCm: null,
        headCircumferenceCm: null,
        rowNote: correctionNote(item),
      })
      result.saved++
    } catch (error) {
      result.failed.push({
        rowNumber: item.rowNumber,
        name: item.name,
        message:
          error instanceof Error ? error.message : "Gagal menyimpan baris ini.",
      })
    }
  }
  return result
}
