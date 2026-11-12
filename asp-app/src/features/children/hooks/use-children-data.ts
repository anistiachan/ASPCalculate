"use client"

import { useLiveQuery } from "dexie-react-hooks"

import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"
import { getDb } from "@/infrastructure/storage/db"
import {
  getChild,
  getMeasurement,
  listAllMeasurements,
  listChildren,
  listMeasurementsForChild,
} from "@/infrastructure/storage/repositories/child-repository"
import { todayIso } from "@/lib/date/completed-months"

import {
  buildChildSummaries,
  type ChildSummary,
} from "../services/child-summaries"

/**
 * Hook data reaktif: hasilnya diperbarui otomatis saat data di IndexedDB berubah.
 * `undefined` = masih dimuat. `null` (untuk satu data) = tidak ditemukan.
 * Akses database hanya terjadi di dalam query, jadi aman saat render di server.
 */

export function useChildSummaries(): ChildSummary[] | undefined {
  return useLiveQuery(async () => {
    const db = getDb()
    const [children, measurements] = await Promise.all([
      listChildren(db),
      listAllMeasurements(db),
    ])
    return buildChildSummaries(children, measurements, todayIso())
  }, [])
}

export function useChild(id: string): StoredChild | null | undefined {
  return useLiveQuery(() => getChild(getDb(), id), [id])
}

export function useChildMeasurements(
  childId: string
): StoredMeasurement[] | undefined {
  return useLiveQuery(
    () => listMeasurementsForChild(getDb(), childId),
    [childId]
  )
}

export function useMeasurement(
  id: string
): StoredMeasurement | null | undefined {
  return useLiveQuery(() => getMeasurement(getDb(), id), [id])
}
