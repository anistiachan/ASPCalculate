import { describe, expect, it } from "vitest"

import type { SheetData, WorkbookData } from "../../types"
import { planImport } from "../../services/plan-import"
import { validateBatch } from "../../validators/validate-batch"
import { detectAdapter } from ".."
import { karangtawarAdapter } from "./karangtawar-adapter"
import { columnIndex } from "./layout"

/** Sheet Posyandu sintetis: header baris 7 dan baris anak mulai baris 9. */
function posyanduSheet(
  name: string,
  rows: Record<string, unknown>[]
): SheetData {
  const grid: unknown[][] = Array.from({ length: 308 }, () =>
    Array.from({ length: 80 }, () => null)
  )
  grid[6][columnIndex("L")] = "NAMA POSYANDU"
  grid[6][columnIndex("N")] = "NAMA ANAK"
  rows.forEach((cells, i) => {
    for (const [letters, value] of Object.entries(cells)) {
      grid[8 + i][columnIndex(letters)] = value
    }
  })
  return { name, rows: grid }
}

const baseChild = (overrides: Record<string, unknown> = {}) => ({
  L: "Jeruk",
  N: "Anak Contoh Satu",
  O: 1,
  D: 2,
  E: 3.1,
  F: 49,
  P: 14,
  R: 25,
  S: 10,
  T: 3,
  U: 24, // lahir 10 Maret 2024
  ...overrides,
})

const workbook = (...sheets: SheetData[]): WorkbookData => ({ sheets })

describe("karangtawarAdapter.detect", () => {
  it("mengenali sheet P1 dengan header NAMA POSYANDU dan NAMA ANAK", () => {
    expect(karangtawarAdapter.detect(workbook(posyanduSheet("P1", [])))).toBe(
      true
    )
    expect(detectAdapter(workbook(posyanduSheet("P1", [])))?.id).toBe(
      "asp-karangtawar"
    )
  })

  it("menolak sheet P1 tanpa header yang sesuai", () => {
    const sheet = posyanduSheet("P1", [])
    sheet.rows[6][columnIndex("L")] = "LAIN"
    expect(karangtawarAdapter.detect(workbook(sheet))).toBe(false)
  })

  it("menolak sheet yang namanya bukan P1…P10", () => {
    expect(karangtawarAdapter.detect(workbook(posyanduSheet("Data", [])))).toBe(
      false
    )
  })
})

describe("karangtawarAdapter.parse", () => {
  it("membaca anak: Posyandu, jenis kelamin dari kode 1/2, tanggal lahir dari tiga kolom", () => {
    const batch = karangtawarAdapter.parse(
      workbook(
        posyanduSheet("P1", [baseChild(), baseChild({ N: "Anak Dua", O: 2 })])
      ),
      "k.xlsx"
    )
    expect(batch.children).toHaveLength(2)
    const [first, second] = batch.children
    expect(first).toMatchObject({
      posyandu: "JERUK",
      keyKind: "composite",
      sex: "M",
      birthDate: "2024-03-10",
      birthOrder: 2,
      birthWeightKg: 3.1,
      birthLengthCm: 49,
    })
    expect(second.sex).toBe("F")
    // Kunci gabungan, bukan NIK.
    expect(first.sourceKey).toBe("KT|JERUK|ANAK CONTOH SATU|2024-03-10")
  })

  it("membaca berat per bulan, tinggi hanya dari kolom isian, dan Vitamin A", () => {
    const batch = karangtawarAdapter.parse(
      workbook(
        posyanduSheet("P1", [
          baseChild({
            AE: 10, // Jan BB
            AF: 80, // Jan TB
            AH: 10.4, // Feb BB
            AI: 81, // Feb TB
            AJ: 1, // Feb Vit A biru
            AO: 10.7, // Mar BB
            AP: 82.5, // Mar TB = rumus perkiraan workbook: tidak boleh diimpor
          }),
        ])
      ),
      "k.xlsx"
    )
    const byDate = Object.fromEntries(
      batch.measurements.map((m) => [m.measuredAt, m])
    )
    expect(Object.keys(byDate).sort()).toEqual([
      "2025-01-14",
      "2025-02-14",
      "2025-03-14",
    ])
    expect(byDate["2025-01-14"]).toMatchObject({
      weightKg: 10,
      rawLengthHeightCm: 80,
      vitaminAStatus: null,
    })
    expect(byDate["2025-02-14"]).toMatchObject({
      weightKg: 10.4,
      rawLengthHeightCm: 81,
      vitaminAStatus: true,
    })
    expect(byDate["2025-03-14"]).toMatchObject({
      weightKg: 10.7,
      rawLengthHeightCm: null,
    })
  })

  it("membaca ASI eksklusif pada umur anak: Ya = true, Tdk = false, di luar 0–6 bulan diabaikan", () => {
    const batch = karangtawarAdapter.parse(
      workbook(
        posyanduSheet("P1", [
          // Lahir 10 Des 2025 → umur 2 bulan pada Februari 2026: ASI ya.
          baseChild({ N: "Bayi Ya", S: 10, T: 12, U: 25, R: 26, AL: 1 }),
          // Umur 3 bulan pada Februari: ASI tidak.
          baseChild({ N: "Bayi Tidak", S: 10, T: 11, U: 25, R: 26, AM: 1 }),
          // Umur 12 bulan pada Februari: di luar rentang ASI, tanpa data lain tidak ada pengukuran.
          baseChild({ N: "Anak Besar", S: 10, T: 2, U: 25, R: 26, AL: 1 }),
        ])
      ),
      "k.xlsx"
    )
    const byName = Object.fromEntries(
      batch.measurements.map((m) => [m.sourceChildName, m])
    )
    expect(byName["Bayi Ya"].breastfeedingByMonth).toEqual({ 2: true })
    expect(byName["Bayi Tidak"].breastfeedingByMonth).toEqual({ 3: false })
    expect(byName["Anak Besar"]).toBeUndefined()
  })

  it("membaca Nov/Des tahun sebelumnya untuk pembanding Januari", () => {
    const batch = karangtawarAdapter.parse(
      workbook(posyanduSheet("P1", [baseChild({ V: 9.5, X: 9.8, AE: 10 })])),
      "k.xlsx"
    )
    expect(batch.measurements.map((m) => m.measuredAt).sort()).toEqual([
      "2024-11-14",
      "2024-12-14",
      "2025-01-14",
    ])
  })

  it("memakai hari dari kolom tanggal ukur bila masuk akal, selain itu tanggal 14", () => {
    const withDay = karangtawarAdapter.parse(
      workbook(posyanduSheet("P1", [baseChild({ P: 9, AE: 10 })])),
      "k.xlsx"
    )
    expect(withDay.measurements[0].measuredAt).toBe("2025-01-09")
    const invalidDay = karangtawarAdapter.parse(
      workbook(posyanduSheet("P1", [baseChild({ P: 31, AE: 10 })])),
      "k.xlsx"
    )
    expect(invalidDay.measurements[0].measuredAt).toBe("2025-01-14")
  })

  it("nilai 0 dianggap kosong, bukan berat nol", () => {
    const batch = karangtawarAdapter.parse(
      workbook(posyanduSheet("P1", [baseChild({ AE: 0, AH: 11 })])),
      "k.xlsx"
    )
    expect(batch.measurements).toHaveLength(1)
    expect(batch.measurements[0].measuredAt).toBe("2025-02-14")
  })

  it("baris tanpa nama dilewati; kode jenis kelamin atau tanggal lahir tidak sah ditolak", () => {
    const batch = karangtawarAdapter.parse(
      workbook(
        posyanduSheet("P1", [
          baseChild({ N: "" }),
          baseChild({ N: "Salah Kelamin", O: 3 }),
          baseChild({ N: "Salah Tanggal", S: 31, T: 2 }),
          baseChild({ N: "Tanpa Posyandu", L: "" }),
        ])
      ),
      "k.xlsx"
    )
    expect(batch.children).toHaveLength(0)
    const fields = batch.issues
      .filter((i) => i.severity === "error")
      .map((i) => i.field)
    expect(fields).toEqual(["sex", "birthDate", "posyandu"])
  })

  it("pesan masalah tidak memuat nama anak", () => {
    const batch = karangtawarAdapter.parse(
      workbook(posyanduSheet("P1", [baseChild({ N: "Rahasia Besar", O: 9 })])),
      "k.xlsx"
    )
    expect(JSON.stringify(batch.issues)).not.toContain("Rahasia")
  })

  it("sheet lain dan sheet Posyandu kosong dilewati dengan alasan", () => {
    const other: SheetData = { name: "SKDN", rows: [[1]] }
    const batch = karangtawarAdapter.parse(
      workbook(
        posyanduSheet("P1", [baseChild({ AE: 10 })]),
        posyanduSheet("P2", []),
        other
      ),
      "k.xlsx"
    )
    expect(batch.skippedSheets.map((s) => s.name).sort()).toEqual([
      "P2",
      "SKDN",
    ])
    expect(batch.sheetSummaries.map((s) => s.sheet)).toEqual(["P1", "P1"])
  })

  it("memberi peringatan bahwa cara ukur dan hari ukur tidak tercatat", () => {
    const batch = karangtawarAdapter.parse(
      workbook(posyanduSheet("P1", [baseChild({ AE: 10 })])),
      "k.xlsx"
    )
    const codes = batch.issues.filter((i) => i.severity === "warning")
    expect(codes.map((i) => i.code)).toContain("POSITION_UNKNOWN")
    expect(codes.some((i) => i.field === "measuredAt")).toBe(true)
  })
})

describe("import Karangtawar lewat validasi dan perencana", () => {
  const options = {
    batchId: "b1",
    now: "2026-01-01T00:00:00.000Z",
    newId: (() => {
      let n = 0
      return () => `id${++n}`
    })(),
  }

  it("menyimpan kunci gabungan sebagai importKey (bukan NIK) beserta Posyandu", () => {
    const validated = validateBatch(
      karangtawarAdapter.parse(
        workbook(posyanduSheet("P1", [baseChild({ AE: 10 })])),
        "k.xlsx"
      )
    )
    const plan = planImport(
      validated,
      { children: [], measurements: [] },
      options
    )
    expect(plan.newChildren).toHaveLength(1)
    expect(plan.newChildren[0]).toMatchObject({
      sourceKey: null,
      importKey: "KT|JERUK|ANAK CONTOH SATU|2024-03-10",
      posyandu: "JERUK",
    })
    expect(plan.newMeasurements).toHaveLength(1)
  })

  it("mengimpor berkas yang sama dua kali tidak menggandakan data", () => {
    const validated = validateBatch(
      karangtawarAdapter.parse(
        workbook(posyanduSheet("P1", [baseChild({ AE: 10, AH: 10.5 })])),
        "k.xlsx"
      )
    )
    const first = planImport(
      validated,
      { children: [], measurements: [] },
      options
    )
    const second = planImport(
      validated,
      { children: first.newChildren, measurements: first.newMeasurements },
      options
    )
    expect(second.newChildren).toHaveLength(0)
    expect(second.newMeasurements).toHaveLength(0)
    expect(second.summary.childrenUnchanged).toBe(1)
    expect(second.summary.measurementsDuplicate).toBe(2)
  })

  it("dua anak sama nama dan tanggal lahir di Posyandu yang sama dianggap ambigu", () => {
    const validated = validateBatch(
      karangtawarAdapter.parse(
        workbook(
          posyanduSheet("P1", [baseChild({ AE: 10 }), baseChild({ AE: 11 })])
        ),
        "k.xlsx"
      )
    )
    expect(validated.children).toHaveLength(0)
    expect(validated.issues.some((i) => i.code === "CHILD_DUPLICATE_KEY")).toBe(
      true
    )
  })

  it("anak kembar nama sama di Posyandu berbeda tetap dua anak", () => {
    const validated = validateBatch(
      karangtawarAdapter.parse(
        workbook(
          posyanduSheet("P1", [baseChild({ AE: 10 })]),
          posyanduSheet("P2", [baseChild({ L: "Pepaya", AE: 11 })])
        ),
        "k.xlsx"
      )
    )
    expect(validated.children).toHaveLength(2)
  })
})
