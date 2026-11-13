import * as XLSX from "xlsx"

import { CATEGORY_LABELS } from "@/domain/anthropometry/classification"
import {
  STATUS_LIST_DEFS,
  TARGET_LIST_DEFS,
  type StatusLists,
  type TargetListId,
  type TargetLists,
  type TargetStatus,
} from "@/domain/reporting/lists"
import { formatMonth } from "@/lib/format/format"

export type ListsWorkbookMeta = {
  generatedOn: string
  /** Nama Posyandu bila disaring; kosong = semua. */
  scope?: string
  validated: boolean
}

type Row = (string | number | null)[]

const STATUS_LABELS: Record<TargetListId, Record<TargetStatus, string>> = {
  VITAMIN_A_BIRU: { YES: "Sudah", NO: "Tidak", UNKNOWN: "Belum tercatat" },
  VITAMIN_A_MERAH: { YES: "Sudah", NO: "Tidak", UNKNOWN: "Belum tercatat" },
  ASI: { YES: "Ya", NO: "Tidak", UNKNOWN: "Belum diisi" },
}

function sheet(rows: Row[], widths: number[]): XLSX.WorkSheet {
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  worksheet["!cols"] = widths.map((wch) => ({ wch }))
  return worksheet
}

const label = (key: keyof typeof CATEGORY_LABELS | null) =>
  key === null ? "–" : CATEGORY_LABELS[key]

/**
 * Berkas Excel daftar balita. BERBEDA dari rekap agregat: memuat NAMA anak, sehingga berisi
 * data pribadi. Tidak memuat NIK, tanggal lahir, atau catatan pengguna. Nama ditulis sebagai
 * sel teks bertipe string, jadi nama yang diawali "=" tidak pernah dijalankan sebagai rumus.
 */
export function buildListsWorkbook(
  month: string,
  status: StatusLists,
  targets: TargetLists,
  meta: ListsWorkbookMeta
): Uint8Array {
  const book = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(
    book,
    sheet(
      [
        ["Daftar balita OpenASP"],
        ["Periode", formatMonth(month)],
        ["Posyandu", meta.scope ?? "Semua Posyandu"],
        ["Dibuat pada", meta.generatedOn],
        [],
        [
          "PERHATIAN: berkas ini memuat nama anak. Simpan dan bagikan hanya kepada petugas yang berkepentingan.",
        ],
        [
          meta.validated
            ? "Mesin antropometri telah ditinjau tenaga kesehatan."
            : "PERHATIAN: status gizi belum divalidasi oleh tenaga kesehatan dan tidak boleh dipakai untuk keputusan layanan gizi.",
        ],
        [
          "Status gizi memakai WHO 2006 dan Permenkes 2/2020, bukan tabel status gizi bawaan workbook ASP.",
        ],
        [],
        ["Daftar", "Jumlah", "Definisi"],
        ...STATUS_LIST_DEFS.map((def): Row => [
          def.title,
          status.lists[def.id].length,
          def.definition,
        ]),
        ...TARGET_LIST_DEFS.map((def): Row => [
          def.title,
          targets.lists[def.id].length,
          def.definition,
        ]),
      ],
      [30, 10, 110]
    ),
    "Catatan"
  )

  for (const def of STATUS_LIST_DEFS) {
    const rows: Row[] = [
      [
        "Nama",
        "Posyandu",
        "L/P",
        "Umur (bulan)",
        "BB (kg)",
        "TB (cm)",
        "BB/U",
        "Z BB/U",
        "TB/U",
        "Z TB/U",
        "BB/PB-TB",
        "Z BB/PB-TB",
      ],
      ...status.lists[def.id].map((e): Row => [
        e.name,
        e.posyandu,
        e.sex === "M" ? "L" : "P",
        e.ageMonths,
        e.weightKg,
        e.heightCm,
        label(e.wazCategory),
        e.waz,
        label(e.hazCategory),
        e.haz,
        label(e.whzCategory),
        e.whz,
      ]),
    ]
    XLSX.utils.book_append_sheet(
      book,
      sheet(rows, [28, 12, 5, 12, 8, 8, 26, 8, 26, 8, 26, 10]),
      def.title.slice(0, 31)
    )
  }

  for (const def of TARGET_LIST_DEFS) {
    const rows: Row[] = [
      ["Nama", "Posyandu", "L/P", "Umur (bulan)", "Status"],
      ...targets.lists[def.id].map((e): Row => [
        e.name,
        e.posyandu,
        e.sex === "M" ? "L" : "P",
        e.ageMonths,
        STATUS_LABELS[def.id][e.status],
      ]),
    ]
    XLSX.utils.book_append_sheet(
      book,
      sheet(rows, [28, 12, 5, 12, 16]),
      def.title.slice(0, 31)
    )
  }

  return new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }))
}
