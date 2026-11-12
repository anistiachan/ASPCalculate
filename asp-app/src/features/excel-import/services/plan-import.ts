import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"

import type { ValidatedBatch } from "../validators/validate-batch"
import type { ImportedChild, ImportedMeasurement, ImportIssue } from "../types"

export type ExistingData = {
  children: readonly StoredChild[]
  measurements: readonly StoredMeasurement[]
}

export type ImportPlan = {
  batchId: string
  newChildren: StoredChild[]
  newMeasurements: StoredMeasurement[]
  /** Konflik yang dilewati; data lama dipertahankan. */
  issues: ImportIssue[]
  summary: {
    childrenNew: number
    childrenUnchanged: number
    childrenConflict: number
    measurementsNew: number
    measurementsDuplicate: number
    measurementsConflict: number
    /** Pengukuran yang dilewati karena data induk anaknya bentrok. */
    measurementsSkippedChildConflict: number
  }
}

type PlanOptions = {
  batchId: string
  now: string
  newId: () => string
}

const normalizeName = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, " ")

function sameChild(a: ImportedChild, b: StoredChild): boolean {
  return (
    normalizeName(a.name) === normalizeName(b.name) &&
    a.birthDate === b.birthDate &&
    a.sex === b.sex &&
    a.birthOrder === b.birthOrder &&
    a.birthWeightKg === b.birthWeightKg &&
    a.birthLengthCm === b.birthLengthCm &&
    a.birthHeadCircumferenceCm === b.birthHeadCircumferenceCm
  )
}

function sameBreastfeeding(
  a: Record<number, boolean | null>,
  b: Record<number, boolean | null>
): boolean {
  const months = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const month of months) {
    if ((a[Number(month)] ?? null) !== (b[Number(month)] ?? null)) return false
  }
  return true
}

/** Sama jika semua nilai pengukuran sama; asal baris (sheet/nomor baris) tidak dibandingkan. */
function sameMeasurement(
  a: ImportedMeasurement,
  b: StoredMeasurement
): boolean {
  return (
    a.weightKg === b.weightKg &&
    a.rawLengthHeightCm === b.rawLengthHeightCm &&
    a.measurementPosition === b.measurementPosition &&
    a.lilaCm === b.lilaCm &&
    a.headCircumferenceCm === b.headCircumferenceCm &&
    a.rawPittingEdema === b.rawPittingEdema &&
    a.vitaminAStatus === b.vitaminAStatus &&
    a.motherToddlerClassAttendance === b.motherToddlerClassAttendance &&
    a.mbgStatus === b.mbgStatus &&
    a.rowNote === b.rowNote &&
    sameBreastfeeding(a.breastfeedingByMonth, b.breastfeedingByMonth)
  )
}

/**
 * Menentukan apa yang boleh disimpan tanpa menggandakan atau menimpa data.
 *
 * - Anak dikenali dari NIK. Yang belum ada ditambahkan; yang sama persis dilewati;
 *   yang NIK-nya sama tetapi isinya berbeda dilaporkan sebagai konflik dan data
 *   lama dipertahankan.
 * - Pengukuran dikenali dari anak + tanggal ukur dengan aturan yang sama.
 * - Mengimpor file yang sama dua kali tidak menambah data apa pun.
 */
export function planImport(
  validated: ValidatedBatch,
  existing: ExistingData,
  options: PlanOptions
): ImportPlan {
  const issues: ImportIssue[] = []
  const summary: ImportPlan["summary"] = {
    childrenNew: 0,
    childrenUnchanged: 0,
    childrenConflict: 0,
    measurementsNew: 0,
    measurementsDuplicate: 0,
    measurementsConflict: 0,
    measurementsSkippedChildConflict: 0,
  }

  const childByKey = new Map(
    existing.children.map((child) => [child.sourceKey, child])
  )
  const conflictedKeys = new Set<string>()
  const newChildren: StoredChild[] = []

  for (const incoming of validated.children) {
    const current = childByKey.get(incoming.sourceKey)
    if (!current) {
      const stored: StoredChild = {
        id: options.newId(),
        sourceKey: incoming.sourceKey,
        name: incoming.name,
        birthDate: incoming.birthDate,
        sex: incoming.sex,
        birthOrder: incoming.birthOrder,
        birthWeightKg: incoming.birthWeightKg,
        birthLengthCm: incoming.birthLengthCm,
        birthHeadCircumferenceCm: incoming.birthHeadCircumferenceCm,
        importBatchId: options.batchId,
        createdAt: options.now,
      }
      newChildren.push(stored)
      childByKey.set(stored.sourceKey, stored)
      summary.childrenNew++
    } else if (sameChild(incoming, current)) {
      summary.childrenUnchanged++
    } else {
      conflictedKeys.add(incoming.sourceKey)
      summary.childrenConflict++
      issues.push({
        severity: "error",
        code: "CHILD_CONFLICT",
        message:
          "Anak dengan NIK ini sudah tersimpan dengan data berbeda; data lama dipertahankan dan baris dilewati.",
        sheet: incoming.source.sheet,
        row: incoming.source.row,
      })
    }
  }

  const measurementByIdentity = new Map<string, StoredMeasurement>()
  for (const measurement of existing.measurements) {
    measurementByIdentity.set(
      `${measurement.childId}|${measurement.measuredAt}`,
      measurement
    )
  }

  const newMeasurements: StoredMeasurement[] = []
  for (const incoming of validated.measurements) {
    const { sheet, row } = incoming.source

    if (conflictedKeys.has(incoming.sourceChildKey)) {
      summary.measurementsSkippedChildConflict++
      issues.push({
        severity: "error",
        code: "CHILD_CONFLICT",
        message:
          "Pengukuran dilewati karena data induk anaknya bentrok dengan data tersimpan.",
        sheet,
        row,
      })
      continue
    }

    const child = childByKey.get(incoming.sourceChildKey)
    // Pengukuran yang lolos validasi selalu punya anak; guard ini untuk keamanan tipe.
    if (!child) continue

    const identity = `${child.id}|${incoming.measuredAt}`
    const current = measurementByIdentity.get(identity)
    if (current) {
      if (sameMeasurement(incoming, current)) {
        summary.measurementsDuplicate++
      } else {
        summary.measurementsConflict++
        issues.push({
          severity: "error",
          code: "MEASUREMENT_CONFLICT",
          message:
            "Sudah ada pengukuran untuk anak dan tanggal ini dengan nilai berbeda; data lama dipertahankan.",
          sheet,
          row,
        })
      }
      continue
    }

    const stored: StoredMeasurement = {
      id: options.newId(),
      childId: child.id,
      measuredAt: incoming.measuredAt,
      weightKg: incoming.weightKg,
      rawLengthHeightCm: incoming.rawLengthHeightCm,
      measurementPosition: incoming.measurementPosition,
      rawMeasurementPosition: incoming.rawMeasurementPosition,
      lilaCm: incoming.lilaCm,
      headCircumferenceCm: incoming.headCircumferenceCm,
      rawPittingEdema: incoming.rawPittingEdema,
      vitaminAStatus: incoming.vitaminAStatus,
      breastfeedingByMonth: incoming.breastfeedingByMonth,
      motherToddlerClassAttendance: incoming.motherToddlerClassAttendance,
      mbgStatus: incoming.mbgStatus,
      rowNote: incoming.rowNote,
      sourceSheet: sheet,
      sourceRow: row,
      importBatchId: options.batchId,
      createdAt: options.now,
    }
    newMeasurements.push(stored)
    measurementByIdentity.set(identity, stored)
    summary.measurementsNew++
  }

  return {
    batchId: options.batchId,
    newChildren,
    newMeasurements,
    issues,
    summary,
  }
}
