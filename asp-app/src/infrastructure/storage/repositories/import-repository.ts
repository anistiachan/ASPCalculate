import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"

import type { OpenAspDatabase } from "../db"

export type ImportWritePlan = {
  batchId: string
  newChildren: StoredChild[]
  newMeasurements: StoredMeasurement[]
}

export type ImportBatchMeta = {
  fileName: string
  adapterId: string
  importedAt: string
}

/**
 * Membaca data yang sudah ada, menyusun rencana, lalu menulisnya dalam SATU
 * transaksi. Dengan begitu dua import yang berjalan bersamaan (mis. dua tab)
 * tidak bisa menyelipkan data ganda di antara pembacaan dan penulisan, dan
 * kegagalan di tengah jalan tidak meninggalkan data setengah tersimpan.
 *
 * `buildPlan` harus sinkron karena berjalan di dalam transaksi IndexedDB.
 */
export async function applyImport<TPlan extends ImportWritePlan>(
  db: OpenAspDatabase,
  meta: ImportBatchMeta,
  buildPlan: (existing: {
    children: StoredChild[]
    measurements: StoredMeasurement[]
  }) => TPlan
): Promise<TPlan> {
  return db.transaction(
    "rw",
    db.children,
    db.measurements,
    db.importBatches,
    async () => {
      const existing = {
        children: await db.children.toArray(),
        measurements: await db.measurements.toArray(),
      }
      const plan = buildPlan(existing)

      await db.children.bulkAdd(plan.newChildren)
      await db.measurements.bulkAdd(plan.newMeasurements)
      await db.importBatches.add({
        id: plan.batchId,
        fileName: meta.fileName,
        adapterId: meta.adapterId,
        importedAt: meta.importedAt,
        childrenAdded: plan.newChildren.length,
        measurementsAdded: plan.newMeasurements.length,
      })

      return plan
    }
  )
}
