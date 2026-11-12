import type { ImportAdapter, WorkbookData } from "../types"
import { buBidanAdapter } from "./bu-bidan/bu-bidan-adapter"

/** Adapter yang tersedia. Adapter ASP Karangtawar menyusul setelah strukturnya dipahami. */
export const IMPORT_ADAPTERS: readonly ImportAdapter[] = [buBidanAdapter]

export function detectAdapter(workbook: WorkbookData): ImportAdapter | null {
  return IMPORT_ADAPTERS.find((adapter) => adapter.detect(workbook)) ?? null
}
