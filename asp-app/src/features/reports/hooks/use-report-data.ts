"use client"

import { useLiveQuery } from "dexie-react-hooks"

import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"
import { getDb } from "@/infrastructure/storage/db"
import {
  listAllMeasurements,
  listChildren,
} from "@/infrastructure/storage/repositories/child-repository"

export type ReportData = {
  children: StoredChild[]
  measurements: StoredMeasurement[]
}

/**
 * Seluruh anak dan pengukuran untuk dashboard dan laporan, diperbarui otomatis saat data
 * berubah. `undefined` = masih dimuat. Data tidak pernah meninggalkan perangkat.
 */
export function useReportData(): ReportData | undefined {
  return useLiveQuery(async () => {
    const db = getDb()
    const [children, measurements] = await Promise.all([
      listChildren(db),
      listAllMeasurements(db),
    ])
    return { children, measurements }
  }, [])
}
