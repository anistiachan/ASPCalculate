import type { OpenAspDatabase } from "@/infrastructure/storage/db"
import { applyImport } from "@/infrastructure/storage/repositories/import-repository"

import type { ValidatedBatch } from "../validators/validate-batch"
import { planImport, type ImportPlan } from "./plan-import"

/**
 * Menyimpan hasil import yang sudah divalidasi ke penyimpanan lokal.
 * Hanya baris tanpa error yang disimpan, dan tidak ada data lama yang ditimpa.
 */
export async function commitImport(
  db: OpenAspDatabase,
  validated: ValidatedBatch,
  deps: { newId?: () => string; now?: () => string } = {}
): Promise<ImportPlan> {
  const newId = deps.newId ?? (() => crypto.randomUUID())
  const importedAt = (deps.now ?? (() => new Date().toISOString()))()
  const batchId = newId()

  return applyImport(
    db,
    {
      fileName: validated.fileName,
      adapterId: validated.adapterId,
      importedAt,
    },
    (existing) =>
      planImport(validated, existing, { batchId, now: importedAt, newId })
  )
}
