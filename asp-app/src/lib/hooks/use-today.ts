"use client"

import { useSyncExternalStore } from "react"

import { todayIso } from "@/lib/date/completed-months"

const subscribe = () => () => {}

/**
 * Tanggal hari ini (`YYYY-MM-DD`) di browser, atau `null` saat render di server.
 *
 * Membaca waktu saat prerender akan "membekukan" tanggal build ke dalam HTML, dan
 * Next.js (Cache Components) menolaknya. Dengan `useSyncExternalStore`, server
 * memakai `null` sehingga komponen cukup menampilkan kerangka, lalu browser
 * mengisi tanggal sebenarnya tanpa hydration mismatch.
 */
export function useToday(): string | null {
  return useSyncExternalStore(subscribe, todayIso, () => null)
}
