import { describe, expect, it } from "vitest"

import {
  buildValidWorkbook,
  CHILD_A_ROW,
  CHILD_B_ROW,
  childrenSheet,
  monthSheet,
  NAME_A,
  NIK_A,
  NIK_B,
  NIK_UNKNOWN,
} from "@/test/fixtures/bu-bidan-workbook"

import { buBidanAdapter } from "../adapters/bu-bidan/bu-bidan-adapter"
import type { WorkbookData } from "../types"
import { validateBatch } from "./validate-batch"

const run = (workbook: WorkbookData) =>
  validateBatch(buBidanAdapter.parse(workbook, "uji.xlsx"))

const codes = (result: ReturnType<typeof run>) =>
  result.issues.map((issue) => issue.code)

describe("validateBatch", () => {
  it("workbook valid hanya menghasilkan peringatan yang diharapkan", () => {
    const result = run(buildValidWorkbook())
    expect(result.children).toHaveLength(2)
    expect(result.measurements).toHaveLength(4)
    expect(result.counts.errors).toBe(0)
    // Satu konflik tanggal lahir tidak ada pada fixture valid; hanya posisi/warning ringan.
    expect(result.counts.measurementsRejected).toBe(0)
  })

  it("menolak pengukuran dengan NIK yang tidak ada di data induk", () => {
    const result = run({
      sheets: [
        childrenSheet([CHILD_A_ROW]),
        monthSheet("JANUARI", [
          {
            NIK: NIK_UNKNOWN,
            TANGGALUKUR: "2025-01-20",
            BERAT: 11,
            TINGGI: 80,
            CARAUKUR: "Berdiri",
          },
        ]),
      ],
    })
    expect(result.measurements).toHaveLength(0)
    expect(codes(result)).toContain("CHILD_NOT_FOUND")
    expect(result.counts.measurementsRejected).toBe(1)
  })

  it("menolak semua baris data induk dengan NIK ganda dan pengukurannya", () => {
    const result = run({
      sheets: [
        childrenSheet([
          CHILD_A_ROW,
          { ...CHILD_A_ROW, nama_anak: "Anak Lain" },
          CHILD_B_ROW,
        ]),
        monthSheet("JANUARI", [
          {
            NIK: NIK_A,
            TANGGALUKUR: "2025-01-20",
            BERAT: 11,
            TINGGI: 80,
            CARAUKUR: "Berdiri",
          },
        ]),
      ],
    })
    expect(result.children.map((child) => child.sourceKey)).toEqual([NIK_B])
    expect(
      result.issues.filter((issue) => issue.code === "CHILD_DUPLICATE_KEY")
    ).toHaveLength(2)
    expect(codes(result)).toContain("CHILD_NOT_FOUND")
    expect(result.measurements).toHaveLength(0)
  })

  it("menolak tanggal ukur sebelum tanggal lahir", () => {
    const result = run({
      sheets: [
        childrenSheet([CHILD_A_ROW]),
        monthSheet("JANUARI", [
          {
            NIK: NIK_A,
            TANGGALUKUR: "2023-03-14",
            BERAT: 3,
            TINGGI: 49,
            CARAUKUR: "Terlentang",
          },
        ]),
      ],
    })
    expect(result.measurements).toHaveLength(0)
    expect(codes(result)).toContain("MEASURED_BEFORE_BIRTH")
  })

  it("menerima tanggal ukur tepat pada tanggal lahir", () => {
    const result = run({
      sheets: [
        childrenSheet([CHILD_A_ROW]),
        monthSheet("JANUARI", [
          {
            NIK: NIK_A,
            TANGGALUKUR: "2023-03-15",
            BERAT: 3,
            TINGGI: 49,
            CARAUKUR: "Terlentang",
          },
        ]),
      ],
    })
    expect(result.measurements).toHaveLength(1)
  })

  it("menolak berat dan tinggi nol atau negatif", () => {
    const result = run({
      sheets: [
        childrenSheet([CHILD_A_ROW]),
        monthSheet("JANUARI", [
          {
            NIK: NIK_A,
            TANGGALUKUR: "2025-01-20",
            BERAT: 0,
            TINGGI: 80,
            CARAUKUR: "Berdiri",
          },
          {
            NIK: NIK_A,
            TANGGALUKUR: "2025-01-21",
            BERAT: 11,
            TINGGI: -5,
            CARAUKUR: "Berdiri",
          },
        ]),
      ],
    })
    expect(result.measurements).toHaveLength(0)
    expect(
      result.issues.filter((issue) => issue.code === "NON_POSITIVE_MEASUREMENT")
    ).toHaveLength(2)
  })

  it("memberi peringatan untuk nama dan tanggal lahir yang berbeda tetapi tetap mengimpor", () => {
    const result = run({
      sheets: [
        childrenSheet([CHILD_A_ROW]),
        monthSheet(
          "JUNI",
          [
            {
              NIK: NIK_A,
              nama_anak: "Nama Lain",
              "TANGGAL LAHIR": "2023-03-16",
              TANGGALUKUR: "2025-06-10",
              BERAT: 12,
              TINGGI: 88,
              CARAUKUR: "Berdiri",
            },
          ],
          { withBirthDate: true }
        ),
      ],
    })
    expect(result.measurements).toHaveLength(1)
    expect(codes(result)).toEqual(
      expect.arrayContaining(["NAME_MISMATCH", "BIRTH_DATE_MISMATCH"])
    )
    expect(result.counts.errors).toBe(0)
  })

  it("tidak menganggap perbedaan huruf besar/kecil dan spasi pada nama sebagai konflik", () => {
    const result = run({
      sheets: [
        childrenSheet([CHILD_A_ROW]),
        monthSheet("JANUARI", [
          {
            NIK: NIK_A,
            nama_anak: `  ${NAME_A.toUpperCase()}  `,
            TANGGALUKUR: "2025-01-20",
            BERAT: 11,
            TINGGI: 80,
            CARAUKUR: "Berdiri",
          },
        ]),
      ],
    })
    expect(codes(result)).not.toContain("NAME_MISMATCH")
  })

  it("menandai pengukuran ganda tanpa menghapusnya", () => {
    const row = {
      NIK: NIK_A,
      TANGGALUKUR: "2025-01-20",
      BERAT: 11,
      TINGGI: 80,
      CARAUKUR: "Berdiri",
    }
    const result = run({
      sheets: [childrenSheet([CHILD_A_ROW]), monthSheet("JANUARI", [row, row])],
    })
    expect(result.measurements).toHaveLength(2)
    expect(
      result.issues.filter((issue) => issue.code === "DUPLICATE_MEASUREMENT")
    ).toHaveLength(1)
  })

  it("tidak memuat NIK atau nama pada pesan masalah validasi", () => {
    const result = run({
      sheets: [
        childrenSheet([CHILD_A_ROW, CHILD_A_ROW]),
        monthSheet("JANUARI", [
          {
            NIK: NIK_A,
            nama_anak: NAME_A,
            TANGGALUKUR: "2025-01-20",
            BERAT: 11,
            TINGGI: 80,
          },
          {
            NIK: NIK_UNKNOWN,
            nama_anak: "Siapa",
            TANGGALUKUR: "2025-01-20",
            BERAT: 11,
            TINGGI: 80,
          },
        ]),
      ],
    })
    const messages = result.issues.map((issue) => issue.message).join("\n")
    expect(messages.length).toBeGreaterThan(0)
    for (const secret of [NIK_A, NIK_B, NIK_UNKNOWN, NAME_A, "Siapa"]) {
      expect(messages).not.toContain(secret)
    }
  })
})
