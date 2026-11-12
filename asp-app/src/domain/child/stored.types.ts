import type { MeasurementPosition, Sex } from "./child.types"

/** Data anak seperti disimpan di perangkat. `id` adalah ID internal OpenASP. */
export type StoredChild = {
  id: string
  /**
   * NIK, disimpan lokal semata-mata supaya import ulang file yang sama dapat
   * mengenali anak yang sudah ada tanpa menggandakannya. Jangan ditampilkan di
   * UI publik, log, atau ekspor tanpa kebutuhan yang jelas.
   */
  sourceKey: string
  name: string
  birthDate: string
  sex: Sex
  birthOrder: number | null
  birthWeightKg: number | null
  birthLengthCm: number | null
  birthHeadCircumferenceCm: number | null
  importBatchId: string
  createdAt: string
}

export type StoredMeasurement = {
  id: string
  childId: string
  measuredAt: string
  weightKg: number | null
  /** Nilai mentah dari sumber; koreksi posisi dihitung terpisah dan tidak menimpa nilai ini. */
  rawLengthHeightCm: number | null
  measurementPosition: MeasurementPosition
  rawMeasurementPosition: string | null
  lilaCm: number | null
  headCircumferenceCm: number | null
  rawPittingEdema: string | null
  vitaminAStatus: boolean | null
  breastfeedingByMonth: Record<number, boolean | null>
  motherToddlerClassAttendance: boolean | null
  mbgStatus: boolean | null
  rowNote: string | null
  sourceSheet: string
  sourceRow: number
  importBatchId: string
  createdAt: string
}

export type StoredImportBatch = {
  id: string
  fileName: string
  adapterId: string
  importedAt: string
  childrenAdded: number
  measurementsAdded: number
}
