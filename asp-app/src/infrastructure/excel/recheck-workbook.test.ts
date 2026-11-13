import * as XLSX from "xlsx"
import { describe, expect, it } from "vitest"

import type { RecheckEntry } from "@/domain/reporting/recheck"

import { buildRecheckWorkbook } from "./recheck-workbook"

const entry = (name: string): RecheckEntry => ({
  childId: name,
  measurementId: `id-${name}`,
  name,
  sex: "F",
  posyandu: "JERUK",
  measuredAt: "2026-06-10",
  weightKg: 8.5,
  heightCm: 70,
  previousMeasuredAt: "2026-05-10",
  previousWeightKg: 8.4,
  previousHeightCm: 74,
  reasons: [
    { code: "TINGGI_TURUN", message: "Tinggi turun dari 74 cm menjadi 70 cm." },
  ],
})

const book = (entries: RecheckEntry[]) =>
  XLSX.read(
    buildRecheckWorkbook("2026-06", entries, { generatedOn: "2026-11-13" }),
    { type: "array" }
  )

const rows = (b: XLSX.WorkBook, name: string) =>
  XLSX.utils.sheet_to_json<unknown[]>(b.Sheets[name], {
    header: 1,
    defval: null,
    blankrows: false,
  })

describe("buildRecheckWorkbook", () => {
  it("memuat kode, ukuran, alasan, dan dua kolom baru yang kosong", () => {
    const b = book([entry("Anak Contoh")])
    expect(b.SheetNames).toEqual(["Petunjuk", "Perlu diukur ulang"])
    const [header, row] = rows(b, "Perlu diukur ulang")
    expect(header.slice(-3)).toEqual([
      "BB baru (kg)",
      "TB baru (cm)",
      "Tgl ukur ulang",
    ])
    expect(row[0]).toBe("id-Anak Contoh")
    expect(row[1]).toBe("Anak Contoh")
    expect(row[10]).toBe("Tinggi turun dari 74 cm menjadi 70 cm.")
    expect(row[11]).toBeNull()
    expect(row[12]).toBeNull()
    expect(row[13]).toBeNull()
  })

  it("petunjuk melarang angka perkiraan dan menyebut data pribadi", () => {
    const text = rows(book([]), "Petunjuk").flat().map(String).join("\n")
    expect(text).toContain("memuat nama anak")
    expect(text).toContain("HASIL UKUR NYATA")
    expect(text).toContain("Jangan mengisi angka perkiraan")
  })

  it("tidak memuat tanggal lahir atau NIK", () => {
    const text = JSON.stringify(rows(book([entry("A")]), "Perlu diukur ulang"))
    expect(text.toLowerCase()).not.toContain("nik")
    expect(text).not.toContain("birth")
  })
})
