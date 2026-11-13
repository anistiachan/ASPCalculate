import type { ImportAdapter, WorkbookData } from "../types"
import { buBidanAdapter } from "./bu-bidan/bu-bidan-adapter"
import { karangtawarAdapter } from "./karangtawar/karangtawar-adapter"
import { psgAdapter } from "./psg/psg-adapter"

/**
 * Adapter yang tersedia, dicoba berurutan; yang pertama mengenali berkas dipakai. Berkas yang
 * memuat sheet P1–P10 dan PSG sekaligus dibaca lewat sheet P (sumber data, bukan hasil hitungan).
 */
export const IMPORT_ADAPTERS: readonly ImportAdapter[] = [
  buBidanAdapter,
  karangtawarAdapter,
  psgAdapter,
]

export function detectAdapter(workbook: WorkbookData): ImportAdapter | null {
  return IMPORT_ADAPTERS.find((adapter) => adapter.detect(workbook)) ?? null
}
