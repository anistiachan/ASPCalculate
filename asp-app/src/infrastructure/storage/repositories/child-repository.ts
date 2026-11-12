import type { MeasurementPosition, Sex } from "@/domain/child/child.types"
import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"

import type { OpenAspDatabase } from "../db"

/**
 * Pesan error di sini sengaja tidak memuat NIK, nama, atau nilai pengguna
 * (pesan error IndexedDB/log bisa bocor). Cukup jenis masalahnya.
 */
export class ChildNotFoundError extends Error {
  constructor() {
    super("Data anak tidak ditemukan.")
  }
}

export class MeasurementNotFoundError extends Error {
  constructor() {
    super("Data pengukuran tidak ditemukan.")
  }
}

export class DuplicateNikError extends Error {
  constructor() {
    super("Sudah ada anak lain dengan NIK yang sama.")
  }
}

export class DuplicateMeasurementDateError extends Error {
  constructor() {
    super("Sudah ada pengukuran untuk anak ini pada tanggal tersebut.")
  }
}

export class MeasurementBeforeBirthError extends Error {
  constructor() {
    super("Tanggal ukur lebih awal dari tanggal lahir.")
  }
}

/** Mengubah tanggal lahir akan membuat sebagian pengukuran terjadi sebelum anak lahir. */
export class BirthDateConflictError extends Error {
  constructor(readonly conflictingMeasurements: number) {
    super(
      `Tanggal lahir baru lebih akhir dari ${conflictingMeasurements} pengukuran yang sudah ada.`
    )
  }
}

export type ChildInput = {
  name: string
  birthDate: string
  sex: Sex
  /** NIK 16 digit, atau null bila tidak diisi. */
  nik: string | null
}

export type MeasurementInput = {
  measuredAt: string
  weightKg: number | null
  /** Panjang/tinggi mentah sesuai posisi ukur; tidak dikoreksi di sini. */
  rawLengthHeightCm: number | null
  measurementPosition: MeasurementPosition
  lilaCm: number | null
  headCircumferenceCm: number | null
  rowNote: string | null
}

export type RepositoryDeps = {
  newId?: () => string
  now?: () => string
}

const defaultNewId = () => crypto.randomUUID()
const defaultNow = () => new Date().toISOString()

// --- Baca --------------------------------------------------------------------

export function listChildren(db: OpenAspDatabase): Promise<StoredChild[]> {
  return db.children.toArray()
}

export function listAllMeasurements(
  db: OpenAspDatabase
): Promise<StoredMeasurement[]> {
  return db.measurements.toArray()
}

export async function getChild(
  db: OpenAspDatabase,
  id: string
): Promise<StoredChild | null> {
  return (await db.children.get(id)) ?? null
}

export async function getMeasurement(
  db: OpenAspDatabase,
  id: string
): Promise<StoredMeasurement | null> {
  return (await db.measurements.get(id)) ?? null
}

/** Riwayat pengukuran anak, terbaru lebih dulu. */
export async function listMeasurementsForChild(
  db: OpenAspDatabase,
  childId: string
): Promise<StoredMeasurement[]> {
  const rows = await db.measurements.where("childId").equals(childId).toArray()
  return rows.sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
}

// --- Anak --------------------------------------------------------------------

export function createChild(
  db: OpenAspDatabase,
  input: ChildInput,
  deps: RepositoryDeps = {}
): Promise<StoredChild> {
  const now = (deps.now ?? defaultNow)()

  return db.transaction("rw", db.children, async () => {
    if (input.nik !== null) {
      const existing = await db.children
        .where("sourceKey")
        .equals(input.nik)
        .first()
      if (existing) throw new DuplicateNikError()
    }

    const child: StoredChild = {
      id: (deps.newId ?? defaultNewId)(),
      sourceKey: input.nik,
      name: input.name,
      birthDate: input.birthDate,
      sex: input.sex,
      birthOrder: null,
      birthWeightKg: null,
      birthLengthCm: null,
      birthHeadCircumferenceCm: null,
      importBatchId: null,
      createdAt: now,
    }
    await db.children.add(child)
    return child
  })
}

export function updateChild(
  db: OpenAspDatabase,
  id: string,
  input: ChildInput,
  deps: RepositoryDeps = {}
): Promise<StoredChild> {
  const now = (deps.now ?? defaultNow)()

  return db.transaction("rw", db.children, db.measurements, async () => {
    const current = await db.children.get(id)
    if (!current) throw new ChildNotFoundError()

    if (input.nik !== null && input.nik !== current.sourceKey) {
      const other = await db.children
        .where("sourceKey")
        .equals(input.nik)
        .first()
      if (other && other.id !== id) throw new DuplicateNikError()
    }

    if (input.birthDate > current.birthDate) {
      const conflicting = await db.measurements
        .where("childId")
        .equals(id)
        .filter((m) => m.measuredAt < input.birthDate)
        .count()
      if (conflicting > 0) throw new BirthDateConflictError(conflicting)
    }

    const updated: StoredChild = {
      ...current,
      sourceKey: input.nik,
      name: input.name,
      birthDate: input.birthDate,
      sex: input.sex,
      updatedAt: now,
    }
    await db.children.put(updated)
    return updated
  })
}

/** Menghapus anak beserta seluruh pengukurannya dalam satu transaksi. */
export function deleteChild(db: OpenAspDatabase, id: string): Promise<void> {
  return db.transaction("rw", db.children, db.measurements, async () => {
    if (!(await db.children.get(id))) throw new ChildNotFoundError()
    await db.measurements.where("childId").equals(id).delete()
    await db.children.delete(id)
  })
}

// --- Pengukuran --------------------------------------------------------------

export function createMeasurement(
  db: OpenAspDatabase,
  childId: string,
  input: MeasurementInput,
  deps: RepositoryDeps = {}
): Promise<StoredMeasurement> {
  const now = (deps.now ?? defaultNow)()

  return db.transaction("rw", db.children, db.measurements, async () => {
    const child = await db.children.get(childId)
    if (!child) throw new ChildNotFoundError()
    if (input.measuredAt < child.birthDate) {
      throw new MeasurementBeforeBirthError()
    }

    const duplicate = await db.measurements
      .where("[childId+measuredAt]")
      .equals([childId, input.measuredAt])
      .first()
    if (duplicate) throw new DuplicateMeasurementDateError()

    const measurement: StoredMeasurement = {
      id: (deps.newId ?? defaultNewId)(),
      childId,
      measuredAt: input.measuredAt,
      weightKg: input.weightKg,
      rawLengthHeightCm: input.rawLengthHeightCm,
      measurementPosition: input.measurementPosition,
      rawMeasurementPosition: null,
      lilaCm: input.lilaCm,
      headCircumferenceCm: input.headCircumferenceCm,
      rawPittingEdema: null,
      vitaminAStatus: null,
      breastfeedingByMonth: {},
      motherToddlerClassAttendance: null,
      mbgStatus: null,
      rowNote: input.rowNote,
      sourceSheet: null,
      sourceRow: null,
      importBatchId: null,
      createdAt: now,
    }
    await db.measurements.add(measurement)
    return measurement
  })
}

export function updateMeasurement(
  db: OpenAspDatabase,
  id: string,
  input: MeasurementInput,
  deps: RepositoryDeps = {}
): Promise<StoredMeasurement> {
  const now = (deps.now ?? defaultNow)()

  return db.transaction("rw", db.children, db.measurements, async () => {
    const current = await db.measurements.get(id)
    if (!current) throw new MeasurementNotFoundError()

    const child = await db.children.get(current.childId)
    if (!child) throw new ChildNotFoundError()
    if (input.measuredAt < child.birthDate) {
      throw new MeasurementBeforeBirthError()
    }

    if (input.measuredAt !== current.measuredAt) {
      const duplicate = await db.measurements
        .where("[childId+measuredAt]")
        .equals([current.childId, input.measuredAt])
        .first()
      if (duplicate && duplicate.id !== id) {
        throw new DuplicateMeasurementDateError()
      }
    }

    // Field hasil import (ASI, vitamin A, dst.) dipertahankan; formulir hanya
    // mengubah nilai ukur dan catatan.
    const updated: StoredMeasurement = {
      ...current,
      measuredAt: input.measuredAt,
      weightKg: input.weightKg,
      rawLengthHeightCm: input.rawLengthHeightCm,
      measurementPosition: input.measurementPosition,
      lilaCm: input.lilaCm,
      headCircumferenceCm: input.headCircumferenceCm,
      rowNote: input.rowNote,
      updatedAt: now,
    }
    await db.measurements.put(updated)
    return updated
  })
}

export async function deleteMeasurement(
  db: OpenAspDatabase,
  id: string
): Promise<void> {
  const deleted = await db.transaction("rw", db.measurements, async () => {
    if (!(await db.measurements.get(id))) return false
    await db.measurements.delete(id)
    return true
  })
  if (!deleted) throw new MeasurementNotFoundError()
}
