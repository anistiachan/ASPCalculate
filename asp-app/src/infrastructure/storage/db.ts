import Dexie, { type EntityTable } from "dexie"

import type {
  StoredChild,
  StoredImportBatch,
  StoredMeasurement,
} from "@/domain/child/stored.types"

export const DB_NAME = "openasp"

export class OpenAspDatabase extends Dexie {
  children!: EntityTable<StoredChild, "id">
  measurements!: EntityTable<StoredMeasurement, "id">
  importBatches!: EntityTable<StoredImportBatch, "id">

  constructor(name: string = DB_NAME) {
    super(name)
    this.version(1).stores({
      // `&` = unik. Indeks unik menjadi jaring pengaman terakhir terhadap data ganda.
      children: "id, &sourceKey, birthDate",
      measurements:
        "id, childId, measuredAt, &[childId+measuredAt], importBatchId",
      importBatches: "id, importedAt",
    })
    // Versi 2: kunci impor non-NIK dan Posyandu (kolom opsional, data lama tetap berlaku).
    this.version(2).stores({
      children: "id, &sourceKey, &importKey, birthDate, posyandu",
    })
  }
}

let instance: OpenAspDatabase | null = null

/** Dibuat saat pertama dipakai; hanya boleh dipanggil di browser (butuh IndexedDB). */
export function getDb(): OpenAspDatabase {
  instance ??= new OpenAspDatabase()
  return instance
}
