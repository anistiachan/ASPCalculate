import type { MeasurementPosition, Sex } from "./child.types"

/** Data anak seperti disimpan di perangkat. `id` adalah ID internal OpenASP. */
export type StoredChild = {
  id: string
  /**
   * NIK. Opsional: anak yang ditambah manual boleh tanpa NIK. Disimpan lokal untuk
   * mengenali anak yang sama saat import ulang tanpa menggandakannya. Jangan
   * ditampilkan penuh di UI, log, atau ekspor tanpa kebutuhan yang jelas.
   *
   * Nilai `null` tidak diindeks IndexedDB, sehingga indeks unik hanya berlaku bagi
   * anak yang punya NIK dan beberapa anak tanpa NIK tidak saling bentrok.
   */
  sourceKey: string | null
  /**
   * Kunci pencocokan import untuk sumber tanpa NIK andal (Posyandu + nama + tanggal lahir).
   * Bukan NIK dan tidak boleh ditampilkan sebagai NIK. Unik bila ada.
   */
  importKey?: string | null
  /** Nama Posyandu, bila diketahui. */
  posyandu?: string | null
  name: string
  birthDate: string
  sex: Sex
  birthOrder: number | null
  birthWeightKg: number | null
  birthLengthCm: number | null
  birthHeadCircumferenceCm: number | null
  /** null jika dibuat manual di aplikasi. */
  importBatchId: string | null
  createdAt: string
  updatedAt?: string
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
  /** null jika dicatat manual di aplikasi. */
  sourceSheet: string | null
  sourceRow: number | null
  importBatchId: string | null
  createdAt: string
  updatedAt?: string
}

export type StoredImportBatch = {
  id: string
  fileName: string
  adapterId: string
  importedAt: string
  childrenAdded: number
  measurementsAdded: number
}
