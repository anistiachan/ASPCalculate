import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { indexMeasurementsByChild } from "@/domain/reporting/monthly-recap"
import { buildSkdn, SKDN_CODES } from "@/domain/reporting/skdn"
import { detectAdapter } from "@/features/excel-import/adapters"
import { planImport } from "@/features/excel-import/services/plan-import"
import { validateBatch } from "@/features/excel-import/validators/validate-batch"
import { readWorkbook } from "@/infrastructure/excel/workbook-reader"

/**
 * Menjaga file contoh di samples/ tetap bisa diimpor seperti yang dijanjikan di
 * samples/README.md. Jika skrip pembuat contoh diubah, jalankan ulang:
 *   node scripts/generate-sample-workbooks.mjs
 */

function importSample(fileName: string) {
  const bytes = readFileSync(join(process.cwd(), "samples", fileName))
  const workbook = readWorkbook(new Uint8Array(bytes))
  const adapter = detectAdapter(workbook)
  expect(adapter?.id).toBe("bu-bidan")
  return validateBatch(adapter!.parse(workbook, fileName))
}

describe.each(["contoh-bu-bidan-valid.xlsx", "contoh-bu-bidan-valid.xls"])(
  "%s",
  (fileName) => {
    const result = importSample(fileName)

    it("diimpor tanpa error dan tanpa peringatan", () => {
      expect(result.issues).toEqual([])
    })

    it("memuat 10 anak dan 26 pengukuran", () => {
      expect(result.children).toHaveLength(10)
      const bySheet = Object.groupBy(result.measurements, (m) => m.source.sheet)
      expect({
        JANUARI: bySheet.JANUARI?.length,
        JUNI: bySheet.JUNI?.length,
        SEPTEMBER: bySheet.SEPTEMBER?.length,
      }).toEqual({ JANUARI: 9, JUNI: 9, SEPTEMBER: 8 })
      expect(result.measurements).toHaveLength(26)
    })

    it("mengenali sheet CONTOH dilewati dan Februari berisi anak belum diukur", () => {
      expect(result.skippedSheets.map((sheet) => sheet.name)).toEqual([
        "CONTOH",
      ])
      const february = result.sheetSummaries.find((s) => s.sheet === "FEBRUARI")
      expect(february).toMatchObject({
        rowsImported: 0,
        rowsWithoutMeasurement: 9,
      })
    })

    it("membaca tiga gaya tanggal ukur dengan benar", () => {
      const dates = new Set(result.measurements.map((m) => m.measuredAt))
      expect(dates).toEqual(new Set(["2026-01-15", "2026-06-12", "2026-09-10"]))
    })

    it("memetakan jenis kelamin dari L/P dan kata lengkap", () => {
      const sexes = result.children.map((child) => child.sex)
      expect(sexes.filter((sex) => sex === "M")).toHaveLength(5)
      expect(sexes.filter((sex) => sex === "F")).toHaveLength(5)
    })

    it("memakai terlentang untuk anak di bawah 24 bulan dan berdiri untuk lainnya", () => {
      const birthDateByKey = new Map(
        result.children.map((child) => [child.sourceKey, child.birthDate])
      )
      for (const m of result.measurements) {
        const birth = birthDateByKey.get(m.sourceChildKey)!
        const [by, bm, bd] = birth.split("-").map(Number)
        const [my, mm, md] = m.measuredAt.split("-").map(Number)
        const months = (my - by) * 12 + (mm - bm) - (md < bd ? 1 : 0)
        expect(m.measurementPosition).toBe(
          months >= 24 ? "STANDING" : "RECUMBENT"
        )
      }
    })

    it("tidak membawa data pribadi ke hasil impor", () => {
      const serialized = JSON.stringify(result)
      expect(serialized).not.toContain("Orang Tua Contoh")
      expect(serialized).not.toContain("alamat sintetis")
      expect(serialized).not.toContain("0800000000")
    })
  }
)

describe("contoh-bu-bidan-bermasalah.xlsx", () => {
  const result = importSample("contoh-bu-bidan-bermasalah.xlsx")
  const issueCodes = (severity: "error" | "warning") =>
    new Set(
      result.issues
        .filter((issue) => issue.severity === severity)
        .map((issue) => issue.code)
    )

  it("memunculkan semua jenis error yang disiapkan", () => {
    expect(issueCodes("error")).toEqual(
      new Set([
        "INVALID_VALUE", // kode jenis kelamin numerik dan berat "abc"
        "MISSING_VALUE", // NIK kosong
        "CHILD_DUPLICATE_KEY",
        "CHILD_NOT_FOUND",
        "MEASURED_BEFORE_BIRTH",
        "NON_POSITIVE_MEASUREMENT",
      ])
    )
  })

  it("memunculkan semua jenis peringatan yang disiapkan", () => {
    expect(issueCodes("warning")).toEqual(
      new Set([
        "FLAGGED_ROW",
        "NAME_MISMATCH",
        "BIRTH_DATE_MISMATCH",
        "POSITION_UNKNOWN",
        "NEEDS_MAPPING",
        "UNKNOWN_COLUMN",
        "DUPLICATE_MEASUREMENT",
      ])
    )
  })

  it("tetap mengimpor baris yang valid dan menolak yang bermasalah", () => {
    // Anak 7 (kode numerik), 8 (tanpa NIK), dan 9 (NIK ganda) ditolak.
    expect(result.children.map((child) => child.name)).toEqual([
      "Anak Contoh 01",
      "Anak Contoh 02",
      "Anak Contoh 03",
      "Anak Contoh 04",
      "Anak Contoh 05",
      "Anak Contoh 06",
    ])
    expect(result.measurements.length).toBeGreaterThan(0)
    expect(result.counts.measurementsRejected).toBeGreaterThan(0)
  })

  it("tidak memuat NIK atau nama pada pesan masalah", () => {
    const messages = result.issues.map((issue) => issue.message).join("\n")
    expect(messages).not.toMatch(/3200\d{12}/)
    expect(messages).not.toContain("Anak Contoh")
    expect(messages).not.toContain("Nama Yang Berbeda")
  })
})

describe("contoh-karangtawar.xlsx", () => {
  const bytes = readFileSync(
    join(process.cwd(), "samples", "contoh-karangtawar.xlsx")
  )
  const workbook = readWorkbook(new Uint8Array(bytes))
  const adapter = detectAdapter(workbook)
  const validated = validateBatch(
    adapter!.parse(workbook, "contoh-karangtawar.xlsx")
  )

  it("dikenali sebagai format ASP Karangtawar dan diimpor tanpa error", () => {
    expect(adapter?.id).toBe("asp-karangtawar")
    expect(validated.counts.errors).toBe(0)
    expect(validated.children).toHaveLength(6)
    expect(validated.measurements).toHaveLength(14)
    expect(validated.skippedSheets.map((s) => s.name).sort()).toEqual([
      "P3",
      "SKDN",
    ])
  })

  it("SKDN Januari–Maret 2026 sesuai hitungan tangan (draf)", () => {
    let counter = 0
    const plan = planImport(
      validated,
      { children: [], measurements: [] },
      {
        batchId: "b",
        now: "2026-01-01T00:00:00.000Z",
        newId: () => `id${++counter}`,
      }
    )
    const byChild = indexMeasurementsByChild(plan.newMeasurements)
    const all = (month: string) => {
      const { counts } = buildSkdn(month, plan.newChildren, byChild)
      return Object.fromEntries(
        SKDN_CODES.map((code) => [code, counts[code].ALL])
      )
    }
    expect(all("2026-01")).toEqual({
      K: 5,
      D2: 3,
      D25: 2,
      D: 5,
      N: 0,
      T: 0,
      O: 0,
      B: 5,
      T2: 0,
    })
    expect(all("2026-02")).toEqual({
      K: 6,
      D2: 4,
      D25: 1,
      D: 5,
      N: 2,
      T: 2,
      O: 0,
      B: 1,
      T2: 0,
    })
    expect(all("2026-03")).toEqual({
      K: 6,
      D2: 3,
      D25: 1,
      D: 4,
      N: 1,
      T: 2,
      O: 1,
      B: 0,
      T2: 1,
    })
  })
})
