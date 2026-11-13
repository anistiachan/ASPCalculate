import ExcelJS from "exceljs"
import * as XLSX from "xlsx"
import { describe, expect, it } from "vitest"

import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"
import { REMEASURED_NOTE_PREFIX } from "@/domain/reporting/corrections"
import { detectAdapter } from "@/features/excel-import/adapters"
import { karangtawarAdapter } from "@/features/excel-import/adapters/karangtawar/karangtawar-adapter"

import { buildP1Template, buildP1Workbook } from "./p1-workbook"
import { readWorkbook } from "./workbook-reader"

const META = { generatedOn: "2026-11-13", year: 2026, validated: false }

const kid = (
  id: string,
  name: string,
  posyandu: string | null,
  extra: Partial<StoredChild> = {}
): StoredChild =>
  ({
    id,
    name,
    sex: "F",
    birthDate: "2025-04-20",
    posyandu,
    birthOrder: 2,
    birthWeightKg: 3.1,
    birthLengthCm: 49,
    ...extra,
  }) as StoredChild

let counter = 0
const meas = (
  childId: string,
  measuredAt: string,
  weightKg: number | null,
  heightCm: number | null,
  extra: Partial<StoredMeasurement> = {}
): StoredMeasurement =>
  ({
    id: `m${++counter}`,
    childId,
    measuredAt,
    weightKg,
    rawLengthHeightCm: heightCm,
    vitaminAStatus: null,
    breastfeedingByMonth: {},
    rowNote: null,
    ...extra,
  }) as StoredMeasurement

const roundTrip = async (
  children: StoredChild[],
  measurements: StoredMeasurement[]
) => {
  const bytes = await buildP1Workbook(children, measurements, META)
  const workbook = readWorkbook(bytes)
  expect(karangtawarAdapter.detect(workbook)).toBe(true)
  return { bytes, batch: karangtawarAdapter.parse(workbook, "p1.xlsx") }
}

const sheetsOf = (bytes: Uint8Array) => XLSX.read(bytes, { type: "array" })

describe("buildP1Workbook", () => {
  const children = [
    kid("b", "Budi Contoh", "PEPAYA", { sex: "M" }),
    kid("a", "Ani Contoh", "JERUK"),
  ]
  const measurements = [
    meas("a", "2025-12-14", 5.5, 60),
    meas("a", "2026-01-14", 6, 62),
    meas("a", "2026-02-14", 6.4, 63.5, {
      vitaminAStatus: true,
      breastfeedingByMonth: { 10: false },
    }),
    meas("a", "2026-03-14", 6.8, 65),
    meas("b", "2026-02-14", 7, 66),
  ]

  it("satu sheet per Posyandu (urut nama) dan Catatan di akhir", async () => {
    const { bytes } = await roundTrip(children, measurements)
    const book = sheetsOf(bytes)
    expect(book.SheetNames).toEqual(["P1", "P2", "Catatan"])
    expect(book.Sheets["P1"]["L9"].v).toBe("JERUK")
    expect(book.Sheets["P2"]["L9"].v).toBe("PEPAYA")
  })

  it("judul dan header bertingkat seperti sheet P1 asli", async () => {
    const { bytes } = await roundTrip(children, measurements)
    const sheet = sheetsOf(bytes).Sheets["P1"]
    expect(sheet["L3"].v).toBe("HASIL PENGUKURAN ANTROPOMETRI BALITA")
    expect(sheet["L7"].v).toBe("NAMA POSYANDU")
    expect(sheet["N7"].v).toBe("NAMA ANAK")
    expect(sheet["AD6"].v).toBe("JAN")
    expect(sheet["AG6"].v).toBe("FEB")
    expect(sheet["AN6"].v).toBe("MART")
    expect(sheet["BC6"].v).toBe("AGUSTUS")
    expect(sheet["AJ7"].v).toBe("Vit.A")
    expect(sheet["AJ8"].v).toBe("Biru")
    expect(sheet["AL7"].v).toBe("ASI-E")
    expect(sheet["BV6"].v).toBe("STATUS PERTUMBUHAN")
    expect(sheet["BV7"].v).toBe("1")
    expect(sheet["CG7"].v).toBe("12")
  })

  it("dibaca kembali oleh adapter Karangtawar: anak, tanggal lahir, jenis kelamin", async () => {
    const { batch } = await roundTrip(children, measurements)
    expect(batch.issues.filter((i) => i.severity === "error")).toEqual([])
    const byName = new Map(batch.children.map((c) => [c.name, c]))
    expect(byName.get("Ani Contoh")).toMatchObject({
      birthDate: "2025-04-20",
      sex: "F",
      posyandu: "JERUK",
      birthOrder: 2,
      birthWeightKg: 3.1,
      birthLengthCm: 49,
    })
    expect(byName.get("Budi Contoh")?.sex).toBe("M")
  })

  it("berat tetap sama; TB hanya untuk Jan/Feb/Agu/Nov/Des (bulan lain tidak diekspor)", async () => {
    const { batch } = await roundTrip(children, measurements)
    const ani = batch.measurements
      .filter((m) => m.sourceChildName === "Ani Contoh")
      .map((m) => [m.measuredAt.slice(0, 7), m.weightKg, m.rawLengthHeightCm])
    expect(ani).toEqual([
      ["2025-12", 5.5, 60],
      ["2026-01", 6, 62],
      ["2026-02", 6.4, 63.5],
      ["2026-03", 6.8, null], // TB Maret tidak punya kolom isian
    ])
  })

  it("kolom Umur terisi umur kalender tiap bulan", async () => {
    const { bytes } = await roundTrip(children, measurements)
    const sheet = sheetsOf(bytes).Sheets["P1"] // Ani lahir 2025-04
    expect(sheet["AD9"].v).toBe(9) // Januari 2026
    expect(sheet["AG9"].v).toBe(10) // Februari
    expect(sheet["AN9"].v).toBe(11) // Maret
    expect(sheet["BS9"].v).toBe(20) // Desember
  })

  it("STATUS PERTUMBUHAN N/T/B/O per bulan, dengan prioritas rumus workbook", async () => {
    const ms = [
      meas("a", "2026-01-14", 6, 62), // B: pertama kali ditimbang
      meas("a", "2026-02-14", 6.4, 63), // +0,4 kg umur 10 bln (batas 0,3) => N
      meas("a", "2026-03-14", 6.5, 64), // +0,1 kg umur 11 bln (batas 0,2) => T
      meas("a", "2026-05-14", 7, 66), // April kosong => Mei: O
    ]
    const { bytes } = await roundTrip([kid("a", "Ani Contoh", "JERUK")], ms)
    const sheet = sheetsOf(bytes).Sheets["P1"]
    const status = (month: number) =>
      sheet[`${["BV", "BW", "BX", "BY", "BZ"][month - 1]}9`]?.v
    expect(status(1)).toBe("B")
    expect(status(2)).toBe("N")
    expect(status(3)).toBe("T")
    expect(status(4)).toBeUndefined() // tidak ditimbang
    expect(status(5)).toBe("O")
  })

  it("Vitamin A dan ASI eksklusif ikut pada putaran Februari", async () => {
    const { batch } = await roundTrip(children, measurements)
    const feb = batch.measurements.find(
      (m) =>
        m.sourceChildName === "Ani Contoh" && m.measuredAt.startsWith("2026-02")
    )!
    expect(feb.vitaminAStatus).toBe(true)
    // Ani lahir 2025-04: umur kalender Februari 2026 = 10 bulan, di luar 0–6 bulan ASI.
    expect(feb.breastfeedingByMonth).toEqual({})
  })

  it("ASI umur 0–6 bulan ditulis pada kolom Ya/Tidak", async () => {
    const bayi = kid("e", "Eka Contoh", "JERUK", { birthDate: "2025-10-05" })
    const { batch } = await roundTrip(
      [bayi],
      [meas("e", "2026-02-14", 5, 58, { breastfeedingByMonth: { 4: true } })]
    )
    expect(batch.measurements[0].breastfeedingByMonth).toEqual({ 4: true })
  })

  it("sebulan ada beberapa pengukuran: yang terakhir dipakai", async () => {
    const { batch } = await roundTrip(
      [kid("a", "Ani Contoh", "JERUK")],
      [meas("a", "2026-02-02", 6, 62), meas("a", "2026-02-20", 6.3, 63)]
    )
    expect(batch.measurements).toHaveLength(1)
    expect(batch.measurements[0].weightKg).toBe(6.3)
  })

  it("pengukuran di luar tahun data dan anak tanpa pengukuran tahun itu tidak ikut", async () => {
    const { batch } = await roundTrip(
      [kid("a", "Ani Contoh", "JERUK"), kid("z", "Zaki Contoh", "JERUK")],
      [meas("a", "2026-02-14", 6, 62), meas("z", "2024-05-14", 5, 60)]
    )
    expect(batch.children.map((c) => c.name)).toEqual(["Ani Contoh"])
  })

  it("sel hasil ukur ulang diberi komentar berisi ukuran semula", async () => {
    const { bytes } = await roundTrip(
      [kid("a", "Ani Contoh", "JERUK")],
      [
        meas("a", "2026-02-24", 6.4, 64, {
          rowNote: `${REMEASURED_NOTE_PREFIX}. Ukuran semula 2026-02-10: BB 6 kg, TB 60 cm.`,
        }),
      ]
    )
    const sheet = sheetsOf(bytes).Sheets["P1"]
    expect(sheet["AH9"].v).toBe(6.4)
    expect(sheet["AH9"].c?.[0].t).toContain("Ukuran semula 2026-02-10")
    expect(sheet["AI9"].c?.[0].t).toContain("Hasil ukur ulang")
  })

  it("tampilan: panel beku, sel gabungan, blok Agustus dan status berwarna", async () => {
    const { bytes } = await roundTrip(children, measurements)
    const book = new ExcelJS.Workbook()
    await book.xlsx.load(bytes as unknown as ExcelJS.Buffer)
    const sheet = book.getWorksheet("P1")!
    const argb = (address: string) =>
      (sheet.getCell(address).fill as ExcelJS.FillPattern | undefined)?.fgColor
        ?.argb

    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 8 })
    expect(sheet.getCell("AD6").isMerged).toBe(true) // judul bulan tergabung
    expect(argb("BC6")).toBe("FFFF3399") // AGUSTUS merah muda
    expect(argb("BC9")).toBe("FFFF0000") // umur Agustus merah
    expect(argb("BF9")).toBe("FFB4C7E7") // Vit.A biru
    expect(argb("BG9")).toBe("FFFF33CC") // Vit.A merah
    expect(argb("BH9")).toBe("FFFFFF00") // ASI-E
    expect(argb("BV9")).toBe("FFFFFF66") // status pertumbuhan
    expect(argb("I9")).toBe("FFFFFF99") // nama ortu (kuning, dikosongkan)
  })

  it("kolom nama ortu, RT, RW, NIK, dan Buku KIA dikosongkan", async () => {
    const { bytes } = await roundTrip(children, measurements)
    const sheet = sheetsOf(bytes).Sheets["P1"]
    for (const letter of ["A", "B", "C", "G", "H", "I", "J", "K"]) {
      expect(sheet[`${letter}9`]?.v).toBeUndefined()
    }
  })

  it("sel umur hitam untuk umur 61 bulan ke atas (di luar sasaran SKDN)", async () => {
    const tua = kid("t", "Tua Contoh", "JERUK", { birthDate: "2020-12-01" })
    const { bytes } = await roundTrip([tua], [meas("t", "2026-03-14", 15, 100)])
    const book = new ExcelJS.Workbook()
    await book.xlsx.load(bytes as unknown as ExcelJS.Buffer)
    const sheet = book.getWorksheet("P1")!
    const argb = (address: string) =>
      (sheet.getCell(address).fill as ExcelJS.FillPattern | undefined)?.fgColor
        ?.argb
    // Maret 2026: umur kalender 63 bulan.
    expect(sheet.getCell("AN9").value).toBe(63)
    expect(argb("AN9")).toBe("FF000000")
  })

  it("Catatan menyebut data pribadi, belum tervalidasi, dan keterbatasan TB", async () => {
    const { bytes } = await roundTrip(children, measurements)
    const text = XLSX.utils
      .sheet_to_json<unknown[]>(sheetsOf(bytes).Sheets["Catatan"], {
        header: 1,
      })
      .flat()
      .map(String)
      .join("\n")
    expect(text).toContain("memuat nama dan tanggal lahir")
    expect(text).toContain("belum divalidasi")
    expect(text).toContain("TB hanya diekspor")
  })

  it("lebih dari 300 anak per Posyandu dipecah ke beberapa sheet", async () => {
    const many = Array.from({ length: 301 }, (_, i) =>
      kid(`k${i}`, `Anak ${String(i).padStart(3, "0")}`, "JERUK")
    )
    const ms = many.map((c) => meas(c.id, "2026-02-14", 6, 62))
    const bytes = await buildP1Workbook(many, ms, META)
    expect(sheetsOf(bytes).SheetNames).toEqual(["P1", "P2", "Catatan"])
  })
})

describe("buildP1Template (template sheet Posyandu)", () => {
  /** Mengisi sel pada hasil template, seperti yang dilakukan petugas di Excel. */
  function fill(
    bytes: Uint8Array,
    cells: Record<string, string | number>
  ): Uint8Array {
    const book = XLSX.read(bytes, { type: "array" })
    const sheet = book.Sheets["P1"]
    for (const [address, value] of Object.entries(cells)) {
      sheet[address] =
        typeof value === "number" ? { t: "n", v: value } : { t: "s", v: value }
    }
    const range = XLSX.utils.decode_range(sheet["!ref"]!)
    for (const address of Object.keys(cells)) {
      const cell = XLSX.utils.decode_cell(address)
      range.e.r = Math.max(range.e.r, cell.r)
      range.e.c = Math.max(range.e.c, cell.c)
    }
    sheet["!ref"] = XLSX.utils.encode_range(range)
    return new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }))
  }

  it("dikenali adapter Karangtawar, kosong, dan punya sheet petunjuk", async () => {
    const workbook = readWorkbook(await buildP1Template())
    expect(workbook.sheets.map((s) => s.name)).toEqual(["P1", "Petunjuk"])
    const adapter = detectAdapter(workbook)
    expect(adapter?.id).toBe("asp-karangtawar")
    const batch = adapter!.parse(workbook, "template-posyandu-p1.xlsx")
    expect(batch.children).toHaveLength(0)
  })

  it("tampilan mengikuti sheet asli dan 100 baris berborder bernomor", async () => {
    const book = new ExcelJS.Workbook()
    await book.xlsx.load((await buildP1Template()) as unknown as ExcelJS.Buffer)
    const sheet = book.getWorksheet("P1")!
    expect(sheet.getCell("L3").value).toContain("TEMPLATE")
    expect(sheet.getCell("L7").value).toBe("NAMA POSYANDU")
    expect(sheet.getCell("AE7").value).toBe("BB")
    expect(sheet.getCell("AD6").value).toBe("JAN")
    expect(sheet.getCell("BC6").value).toBe("AGUSTUS")
    expect(sheet.getCell("M9").value).toBe(1)
    expect(sheet.getCell("M108").value).toBe(100)
    expect(sheet.getCell("N9").value).toBeNull()
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 8 })
  })

  it("kolom isian punya validasi untuk mencegah salah ketik (mis. TB 814)", async () => {
    const book = new ExcelJS.Workbook()
    await book.xlsx.load((await buildP1Template()) as unknown as ExcelJS.Buffer)
    const sheet = book.getWorksheet("P1")!
    const rule = (address: string) => sheet.getCell(address).dataValidation
    expect(rule("O9")).toMatchObject({ type: "whole", formulae: [1, 2] })
    expect(rule("AE9")).toMatchObject({ type: "decimal", formulae: [1, 30] })
    expect(rule("AF9")).toMatchObject({ type: "decimal", formulae: [35, 130] })
    expect(rule("BE108")?.errorStyle).toBe("stop")
    // Kolom hasil hitungan tidak diberi validasi.
    expect(rule("BV9")).toBeUndefined()
  })

  it("baris yang diisi petugas diimpor", async () => {
    const filled = fill(await buildP1Template(), {
      L9: "JERUK",
      N9: "Anak Uji",
      O9: 1,
      P9: 14,
      R9: 26,
      S9: 5,
      T9: 1,
      U9: 25,
      AE9: 9.8,
      AF9: 74,
      AH9: 10.1,
    })
    const workbook = readWorkbook(filled)
    const batch = detectAdapter(workbook)!.parse(workbook, "x.xlsx")
    expect(batch.issues.filter((i) => i.severity === "error")).toEqual([])
    expect(batch.children[0]).toMatchObject({
      name: "Anak Uji",
      sex: "M",
      birthDate: "2025-01-05",
    })
    expect(
      batch.measurements.map((m) => [
        m.measuredAt,
        m.weightKg,
        m.rawLengthHeightCm,
      ])
    ).toEqual([
      ["2026-01-14", 9.8, 74],
      ["2026-02-14", 10.1, null],
    ])
  })
})
