import { describe, expect, it } from "vitest"

import {
  buildValidWorkbook,
  CHILD_A_ROW,
  childrenSheet,
  excelSerial,
  monthSheet,
  NAME_A,
  NIK_A,
  NIK_B,
  PRIVATE_MARKERS,
} from "@/test/fixtures/bu-bidan-workbook"

import { buBidanAdapter } from "./bu-bidan-adapter"

const parse = (workbook = buildValidWorkbook()) =>
  buBidanAdapter.parse(workbook, "uji.xlsx")

describe("buBidanAdapter.detect", () => {
  it("mengenali workbook dengan Tambah Balita dan sheet bulan", () => {
    expect(buBidanAdapter.detect(buildValidWorkbook())).toBe(true)
  })

  it("menolak workbook tanpa sheet Tambah Balita", () => {
    const workbook = { sheets: [monthSheet("JANUARI", [])] }
    expect(buBidanAdapter.detect(workbook)).toBe(false)
  })

  it("menolak workbook tanpa sheet bulan", () => {
    const workbook = { sheets: [childrenSheet([CHILD_A_ROW])] }
    expect(buBidanAdapter.detect(workbook)).toBe(false)
  })
})

describe("data induk (Tambah Balita)", () => {
  it("menemukan header di baris 2 dan membaca anak", () => {
    const { children } = parse()
    expect(children).toHaveLength(2)

    const [a, b] = children
    expect(a).toMatchObject({
      sourceKey: NIK_A,
      name: NAME_A,
      birthDate: "2023-03-15",
      sex: "M",
      birthOrder: 1,
      birthWeightKg: 3.2,
      birthLengthCm: 49,
      source: { sheet: "Tambah Balita", row: 3 },
    })
    // Tanggal lahir berupa serial Excel dan jenis kelamin P.
    expect(b).toMatchObject({
      sourceKey: NIK_B,
      birthDate: "2024-01-10",
      sex: "F",
    })
  })

  it("tidak mengimpor data pribadi yang tidak dibutuhkan", () => {
    const serialized = JSON.stringify(parse())
    for (const marker of PRIVATE_MARKERS) {
      expect(serialized).not.toContain(marker)
    }
  })

  it("menolak baris dengan jenis kelamin kode numerik", () => {
    const batch = parse({
      sheets: [
        childrenSheet([{ ...CHILD_A_ROW, jenis_kelamin: 1 }]),
        monthSheet("JANUARI", []),
      ],
    })
    expect(batch.children).toHaveLength(0)
    expect(batch.issues).toContainEqual(
      expect.objectContaining({ severity: "error", field: "sex", row: 3 })
    )
  })

  it("menolak baris tanpa NIK, tanggal lahir tidak valid, atau tanpa nama", () => {
    const batch = parse({
      sheets: [
        childrenSheet([
          { ...CHILD_A_ROW, NIK: null },
          { ...CHILD_A_ROW, tgl_lahir: "31/02/2023" },
          { ...CHILD_A_ROW, nama_anak: "" },
        ]),
        monthSheet("JANUARI", []),
      ],
    })
    expect(batch.children).toHaveLength(0)
    const errorRows = batch.issues
      .filter((issue) => issue.severity === "error")
      .map((issue) => issue.row)
    expect(errorRows).toEqual([3, 4, 5])
  })

  it("memberi peringatan untuk baris bertanda hapus/pindah tetapi tetap mengimpornya", () => {
    const batch = parse({
      sheets: [
        childrenSheet([{ ...CHILD_A_ROW, pindah: "ya" }]),
        monthSheet("JANUARI", []),
      ],
    })
    expect(batch.children).toHaveLength(1)
    expect(batch.issues).toContainEqual(
      expect.objectContaining({ code: "FLAGGED_ROW", severity: "warning" })
    )
  })

  it("mengabaikan baris kosong tanpa dihitung", () => {
    const batch = parse({
      sheets: [
        childrenSheet([CHILD_A_ROW, { No: 2 }, {}]),
        monthSheet("JANUARI", []),
      ],
    })
    const summary = batch.sheetSummaries.find((s) => s.kind === "children")
    expect(summary).toMatchObject({ rowsRead: 1, rowsImported: 1 })
  })
})

describe("sheet pengukuran bulanan", () => {
  it("membaca sheet tanpa kolom TANGGAL LAHIR (Januari)", () => {
    const { measurements } = parse()
    const january = measurements.filter((m) => m.source.sheet === "JANUARI")
    expect(january).toHaveLength(2)
    expect(january[0]).toMatchObject({
      sourceChildKey: NIK_A,
      measuredAt: "2025-01-20",
      weightKg: 11.2,
      rawLengthHeightCm: 82.5,
      lilaCm: 14.5,
      measurementPosition: "RECUMBENT",
      rawMeasurementPosition: "Terlentang",
      vitaminAStatus: true,
      birthDateFromSheet: null,
      source: { sheet: "JANUARI", row: 2 },
    })
    expect(january[0].breastfeedingByMonth[0]).toBe(false)
    expect(january[0].breastfeedingByMonth[1]).toBeNull()
  })

  it("menormalisasi tanggal teks, koma desimal, dan posisi berdiri", () => {
    const { measurements } = parse()
    const second = measurements.filter((m) => m.source.sheet === "JANUARI")[1]
    expect(second).toMatchObject({
      measuredAt: "2025-01-20",
      weightKg: 9.8,
      rawLengthHeightCm: 75.5,
      measurementPosition: "STANDING",
    })
  })

  it("membaca sheet dengan kolom TANGGAL LAHIR (Juni) berdasarkan nama header", () => {
    const { measurements } = parse()
    const june = measurements.filter((m) => m.source.sheet === "JUNI")
    expect(june).toHaveLength(2)
    expect(june[0]).toMatchObject({
      measuredAt: "2025-06-10",
      weightKg: 12.4,
      birthDateFromSheet: "2023-03-15",
    })
  })

  it("menghitung anak yang belum diukur tanpa menganggapnya salah", () => {
    const batch = parse()
    const february = batch.sheetSummaries.find((s) => s.sheet === "FEBRUARI")
    expect(february).toMatchObject({
      rowsRead: 2,
      rowsImported: 0,
      rowsWithoutMeasurement: 2,
    })
    expect(batch.issues.filter((i) => i.sheet === "FEBRUARI")).toEqual([])
  })

  it("melewati CONTOH dan menerima template kosong", () => {
    const batch = parse()
    expect(batch.skippedSheets).toEqual([
      expect.objectContaining({ name: "CONTOH" }),
    ])
    expect(batch.measurements.some((m) => m.source.sheet === "CONTOH")).toBe(
      false
    )
    const october = batch.sheetSummaries.find((s) => s.sheet === "OKTOBER")
    expect(october).toMatchObject({ rowsRead: 0, rowsImported: 0 })
  })

  it("tidak mengandalkan urutan kolom", () => {
    const sheet = monthSheet("MARET", [
      {
        NIK: NIK_A,
        TANGGALUKUR: "2025-03-05",
        BERAT: 11,
        TINGGI: 81,
        CARAUKUR: "Berdiri",
      },
    ])
    // Balik urutan kolom pada semua baris.
    sheet.rows = sheet.rows.map((row) => [...row].reverse())
    const batch = parse({
      sheets: [childrenSheet([CHILD_A_ROW]), sheet],
    })
    expect(batch.measurements).toHaveLength(1)
    expect(batch.measurements[0]).toMatchObject({
      sourceChildKey: NIK_A,
      measuredAt: "2025-03-05",
      weightKg: 11,
    })
  })

  it("menolak baris dengan berat bukan angka atau tanggal ukur tidak valid", () => {
    const batch = parse({
      sheets: [
        childrenSheet([CHILD_A_ROW]),
        monthSheet("JANUARI", [
          { NIK: NIK_A, TANGGALUKUR: "2025-01-20", BERAT: "abc", TINGGI: 80 },
          { NIK: NIK_A, TANGGALUKUR: "bukan tanggal", BERAT: 11, TINGGI: 80 },
          { NIK: null, TANGGALUKUR: "2025-01-20", BERAT: 11, TINGGI: 80 },
        ]),
      ],
    })
    expect(batch.measurements).toHaveLength(0)
    const errorRows = batch.issues
      .filter((issue) => issue.severity === "error")
      .map((issue) => issue.row)
    expect(errorRows).toEqual([2, 3, 4])
  })

  it("memberi peringatan untuk cara ukur kosong atau tidak dikenal", () => {
    const batch = parse({
      sheets: [
        childrenSheet([CHILD_A_ROW]),
        monthSheet("JANUARI", [
          { NIK: NIK_A, TANGGALUKUR: "2025-01-20", BERAT: 11, TINGGI: 80 },
          {
            NIK: NIK_A,
            TANGGALUKUR: "2025-01-21",
            BERAT: 11,
            TINGGI: 80,
            CARAUKUR: "duduk",
          },
        ]),
      ],
    })
    expect(batch.measurements).toHaveLength(2)
    expect(batch.measurements.map((m) => m.measurementPosition)).toEqual([
      "UNKNOWN",
      "UNKNOWN",
    ])
    expect(
      batch.issues.filter((i) => i.code === "POSITION_UNKNOWN")
    ).toHaveLength(2)
  })

  it("menyimpan pitting edema apa adanya dan menandai perlu pemetaan", () => {
    const batch = parse({
      sheets: [
        childrenSheet([CHILD_A_ROW]),
        monthSheet("JANUARI", [
          {
            NIK: NIK_A,
            TANGGALUKUR: "2025-01-20",
            BERAT: 11,
            TINGGI: 80,
            CARAUKUR: "Berdiri",
            Pitting_edema: 0,
          },
        ]),
      ],
    })
    expect(batch.measurements[0].rawPittingEdema).toBe("0")
    expect(batch.issues).toContainEqual(
      expect.objectContaining({ code: "NEEDS_MAPPING", severity: "warning" })
    )
  })

  it("tidak menghilangkan data indikator tanpa tanggal ukur secara diam-diam", () => {
    const batch = parse({
      sheets: [
        childrenSheet([CHILD_A_ROW]),
        monthSheet("JANUARI", [{ NIK: NIK_A, vita: "ya" }]),
      ],
    })
    expect(batch.measurements).toHaveLength(0)
    expect(batch.issues).toContainEqual(
      expect.objectContaining({ severity: "warning", code: "MISSING_VALUE" })
    )
  })

  it("melewati sheet bila kolom wajib tidak ada", () => {
    const batch = parse({
      sheets: [
        childrenSheet([CHILD_A_ROW]),
        {
          name: "JANUARI",
          rows: [
            ["No", "NIK", "nama_anak", "CARAUKUR"],
            [1, NIK_A, NAME_A, "Berdiri"],
          ],
        },
      ],
    })
    expect(batch.measurements).toHaveLength(0)
    expect(batch.issues).toContainEqual(
      expect.objectContaining({
        code: "SHEET_MISSING_REQUIRED_COLUMN",
        sheet: "JANUARI",
        row: null,
      })
    )
  })

  it("mengabaikan kolom z-score, status, dan bantu yang ditambahkan lewat rumus Excel", () => {
    const sheet = monthSheet("JANUARI", [
      {
        NIK: NIK_A,
        TANGGALUKUR: "2025-01-05",
        BERAT: 11,
        TINGGI: 81,
        CARAUKUR: "Berdiri",
      },
    ])
    const added = [
      "JK",
      "UMUR (bln)",
      "Z TB/U",
      "Z BB/U",
      "Z BB/TB",
      "STATUS TB/U",
      "STATUS BB/U",
      "STATUS BB/TB",
      "STUNTING?",
      "bantu_tglukur",
      "bantu_hari",
    ]
    sheet.rows = sheet.rows.map((row, index) =>
      index === 0 ? [...row, ...added] : [...row, ...added.map(() => "x")]
    )
    const batch = parse({ sheets: [childrenSheet([CHILD_A_ROW]), sheet] })
    expect(
      batch.issues.filter((issue) => issue.code === "UNKNOWN_COLUMN")
    ).toEqual([])
    expect(batch.measurements).toHaveLength(1)
    expect(batch.measurements[0]).toMatchObject({
      measuredAt: "2025-01-05",
      weightKg: 11,
      rawLengthHeightCm: 81,
    })
  })

  it("melaporkan kolom tidak dikenal sebagai peringatan", () => {
    const sheet = monthSheet("JANUARI", [])
    sheet.rows[0] = [...sheet.rows[0], "KOLOM_BARU"]
    const batch = parse({ sheets: [childrenSheet([CHILD_A_ROW]), sheet] })
    expect(batch.issues).toContainEqual(
      expect.objectContaining({ code: "UNKNOWN_COLUMN", field: "KOLOM_BARU" })
    )
  })
})

describe("privasi pada pesan masalah", () => {
  it("tidak memuat NIK atau nama pada pesan masalah", () => {
    const batch = parse({
      sheets: [
        childrenSheet([
          { ...CHILD_A_ROW, NIK: "3201000000000AB1", pindah: "ya" },
          CHILD_A_ROW,
        ]),
        monthSheet("JANUARI", [
          {
            NIK: NIK_A,
            nama_anak: NAME_A,
            TANGGALUKUR: "x",
            BERAT: "abc",
            TINGGI: 80,
          },
        ]),
      ],
    })
    expect(batch.issues.length).toBeGreaterThan(0)
    const messages = batch.issues.map((issue) => issue.message).join("\n")
    expect(messages).not.toContain(NIK_A)
    expect(messages).not.toContain("3201")
    expect(messages).not.toContain(NAME_A)
  })
})

describe("serial tanggal Excel", () => {
  it("excelSerial pada fixture konsisten dengan parser", () => {
    expect(excelSerial("2025-09-03")).toBe(45903)
  })
})
