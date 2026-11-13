import { z } from "zod"

import type {
  StoredChild,
  StoredImportBatch,
  StoredMeasurement,
} from "@/domain/child/stored.types"

import type { OpenAspDatabase } from "./db"

/*
 * Cadangan dan pemulihan data. Seluruh data OpenASP hidup di IndexedDB browser, sehingga bisa
 * hilang bila data situs dihapus. Cadangan adalah satu berkas JSON berisi semua anak, pengukuran,
 * dan riwayat impor; dibuat dan dibaca di perangkat, tidak pernah dikirim ke server.
 *
 * Berkas memuat NAMA dan TANGGAL LAHIR anak (data pribadi) dan TIDAK dienkripsi.
 *
 * Pemulihan hanya MENAMBAH data yang belum ada. Tidak ada data yang ditimpa atau dihapus; baris
 * yang bentrok dengan data tersimpan dilewati dan dihitung.
 */

export const BACKUP_FORMAT = "openasp-backup"
export const BACKUP_VERSION = 1

export type BackupFile = {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  data: {
    children: StoredChild[]
    measurements: StoredMeasurement[]
    importBatches: StoredImportBatch[]
  }
}

export async function exportBackup(
  db: OpenAspDatabase,
  now: () => string = () => new Date().toISOString()
): Promise<BackupFile> {
  const [children, measurements, importBatches] = await Promise.all([
    db.children.toArray(),
    db.measurements.toArray(),
    db.importBatches.toArray(),
  ])
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now(),
    data: { children, measurements, importBatches },
  }
}

export function serializeBackup(file: BackupFile): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(file))
}

// --- Validasi ----------------------------------------------------------------------------------
// Hanya kolom penting yang diperiksa ketat; kolom lain dibawa apa adanya (looseObject), supaya
// cadangan dari versi aplikasi yang lebih baru atau lebih lama tetap terbaca.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const nullableNumber = z.number().nullable().optional()
const nullableString = z.string().nullable().optional()

const childSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string(),
  birthDate: isoDate,
  sex: z.enum(["M", "F"]),
  sourceKey: nullableString,
  importKey: nullableString,
})

const measurementSchema = z.looseObject({
  id: z.string().min(1),
  childId: z.string().min(1),
  measuredAt: isoDate,
  weightKg: nullableNumber,
  rawLengthHeightCm: nullableNumber,
  breastfeedingByMonth: z.record(z.string(), z.boolean().nullable()).optional(),
})

const batchSchema = z.looseObject({
  id: z.string().min(1),
  fileName: z.string(),
})

export type ParsedBackup =
  | {
      ok: true
      backup: BackupFile
      /** Catatan di dalam berkas yang bentuknya rusak dan dilewati. */
      invalidRecords: number
    }
  | { ok: false; message: string }

export function parseBackup(text: string): ParsedBackup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, message: "Berkas bukan JSON yang valid." }
  }

  const header = z
    .looseObject({
      format: z.literal(BACKUP_FORMAT),
      version: z.number().int().positive(),
      exportedAt: z.string(),
      data: z.looseObject({
        children: z.array(z.unknown()),
        measurements: z.array(z.unknown()),
        importBatches: z.array(z.unknown()).optional(),
      }),
    })
    .safeParse(raw)
  if (!header.success) {
    return {
      ok: false,
      message:
        "Ini bukan berkas cadangan OpenASP. Gunakan berkas yang diunduh dari tombol Unduh cadangan.",
    }
  }
  if (header.data.version > BACKUP_VERSION) {
    return {
      ok: false,
      message:
        "Cadangan ini dibuat oleh versi OpenASP yang lebih baru dan belum bisa dibaca di versi ini.",
    }
  }

  let invalidRecords = 0
  const pick = <T>(items: unknown[], schema: z.ZodType<T>): T[] => {
    const valid: T[] = []
    for (const item of items) {
      const result = schema.safeParse(item)
      if (result.success) valid.push(result.data)
      else invalidRecords++
    }
    return valid
  }

  const children = pick(header.data.data.children, childSchema).map(
    (child) =>
      ({
        ...child,
        sourceKey: child.sourceKey ?? null,
      }) as unknown as StoredChild
  )
  const measurements = pick(
    header.data.data.measurements,
    measurementSchema
  ).map(
    (measurement) =>
      ({
        ...measurement,
        weightKg: measurement.weightKg ?? null,
        rawLengthHeightCm: measurement.rawLengthHeightCm ?? null,
        breastfeedingByMonth: measurement.breastfeedingByMonth ?? {},
      }) as unknown as StoredMeasurement
  )
  const importBatches = pick(
    header.data.data.importBatches ?? [],
    batchSchema
  ) as unknown as StoredImportBatch[]

  return {
    ok: true,
    invalidRecords,
    backup: {
      format: BACKUP_FORMAT,
      version: header.data.version,
      exportedAt: header.data.exportedAt,
      data: { children, measurements, importBatches },
    },
  }
}

// --- Rencana pemulihan -------------------------------------------------------------------------

export type RestorePlan = {
  children: StoredChild[]
  measurements: StoredMeasurement[]
  importBatches: StoredImportBatch[]
  summary: {
    childrenNew: number
    /** Anak yang sudah ada (ID sama). */
    childrenExisting: number
    /** Anak yang kunci NIK atau kunci impornya sudah dipakai anak lain. */
    childrenConflict: number
    measurementsNew: number
    /** Pengukuran yang sudah ada (ID sama, atau anak dan tanggal yang sama). */
    measurementsExisting: number
    /** Pengukuran yang anaknya tidak ada atau tidak bisa dipulihkan. */
    measurementsOrphan: number
    batchesNew: number
  }
}

export function planRestore(
  backup: BackupFile,
  existing: {
    children: readonly StoredChild[]
    measurements: readonly StoredMeasurement[]
    importBatches: readonly StoredImportBatch[]
  }
): RestorePlan {
  const childIds = new Set(existing.children.map((c) => c.id))
  const sourceKeys = new Set(
    existing.children.flatMap((c) => (c.sourceKey ? [c.sourceKey] : []))
  )
  const importKeys = new Set(
    existing.children.flatMap((c) => (c.importKey ? [c.importKey] : []))
  )

  const children: StoredChild[] = []
  let childrenExisting = 0
  let childrenConflict = 0
  for (const child of backup.data.children) {
    if (childIds.has(child.id)) {
      childrenExisting++
      continue
    }
    if (
      (child.sourceKey && sourceKeys.has(child.sourceKey)) ||
      (child.importKey && importKeys.has(child.importKey))
    ) {
      childrenConflict++
      continue
    }
    children.push(child)
    childIds.add(child.id)
    if (child.sourceKey) sourceKeys.add(child.sourceKey)
    if (child.importKey) importKeys.add(child.importKey)
  }

  const measurementIds = new Set(existing.measurements.map((m) => m.id))
  const takenDates = new Set(
    existing.measurements.map((m) => `${m.childId}|${m.measuredAt}`)
  )
  const measurements: StoredMeasurement[] = []
  let measurementsExisting = 0
  let measurementsOrphan = 0
  for (const measurement of backup.data.measurements) {
    if (!childIds.has(measurement.childId)) {
      measurementsOrphan++
      continue
    }
    const dateKey = `${measurement.childId}|${measurement.measuredAt}`
    if (measurementIds.has(measurement.id) || takenDates.has(dateKey)) {
      measurementsExisting++
      continue
    }
    measurements.push(measurement)
    measurementIds.add(measurement.id)
    takenDates.add(dateKey)
  }

  const batchIds = new Set(existing.importBatches.map((b) => b.id))
  const importBatches = backup.data.importBatches.filter(
    (batch) => !batchIds.has(batch.id)
  )

  return {
    children,
    measurements,
    importBatches,
    summary: {
      childrenNew: children.length,
      childrenExisting,
      childrenConflict,
      measurementsNew: measurements.length,
      measurementsExisting,
      measurementsOrphan,
      batchesNew: importBatches.length,
    },
  }
}

/** Menyimpan rencana dalam satu transaksi: semuanya masuk atau tidak sama sekali. */
export async function applyRestore(
  db: OpenAspDatabase,
  plan: RestorePlan
): Promise<void> {
  await db.transaction(
    "rw",
    db.children,
    db.measurements,
    db.importBatches,
    async () => {
      await db.children.bulkAdd(plan.children)
      await db.measurements.bulkAdd(plan.measurements)
      await db.importBatches.bulkAdd(plan.importBatches)
    }
  )
}

/** Membaca teks cadangan dan menyusun rencana terhadap data tersimpan; belum menyimpan apa pun. */
export async function previewRestore(
  db: OpenAspDatabase,
  text: string
): Promise<
  | { ok: true; plan: RestorePlan; invalidRecords: number }
  | { ok: false; message: string }
> {
  const parsed = parseBackup(text)
  if (!parsed.ok) return parsed
  const [children, measurements, importBatches] = await Promise.all([
    db.children.toArray(),
    db.measurements.toArray(),
    db.importBatches.toArray(),
  ])
  const plan = planRestore(parsed.backup, {
    children,
    measurements,
    importBatches,
  })
  return { ok: true, plan, invalidRecords: parsed.invalidRecords }
}
