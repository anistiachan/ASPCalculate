import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  CATEGORY_LABELS,
  type NutritionCategory,
} from "@/domain/anthropometry/classification"
import { computeAnthropometry } from "@/domain/anthropometry/compute"
import { loadWho2006References } from "@/domain/anthropometry/references/load-who-2006"
import type { MeasurementPosition } from "@/domain/child/child.types"

/**
 * Pembanding LOKAL: hasil RUMUS Excel (kolom z-score dan status yang ditambahkan
 * scripts/add-zscore-to-bu-bidan.ps1) dibandingkan dengan mesin antropometri OpenASP untuk setiap
 * baris. Dilewati kecuali BU_BIDAN_ZSCORE_JSON berisi jalur berkas JSON nilai sel yang dibuat
 * scripts/dump-bu-bidan-values.ps1 dari workbook yang 'Tambah Balita'-nya sudah diisi (jenis kelamin
 * dan tanggal lahir). Nilainya dibuang lewat Excel karena berkas yang disimpan Excel bisa terproteksi
 * label sensitivitas. JSON berisi data pribadi anak: simpan di luar repositori. Hanya angka agregat
 * dan lokasi baris yang dicetak.
 */

type SheetDump = { firstRow: number; firstCol: number; rows: unknown[][] }

const FILE = process.env.BU_BIDAN_ZSCORE_JSON

const MONTH_SHEETS = [
  "JANUARI",
  "FEBRUARI",
  "MARET",
  "APRIL",
  "MEI",
  "JUNI",
  "JULI",
  "AGUSTUS",
  "SEPTEMBER",
  "OKTOBER",
  "NOVEMBER",
  "DESEMBER",
]

const MONTH_ABBR: Record<string, number> = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
}

const iso = (y: number, m: number, d: number) =>
  `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`

/** Penguraian tanggal tersendiri (bukan salinan rumus Excel) untuk menguji rumusnya. */
function parseDate(value: unknown): string | null {
  if (typeof value === "number") {
    const date = new Date(
      Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000
    )
    return iso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
  }
  if (typeof value !== "string") return null
  const s = value.trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return iso(+m[1], +m[2], +m[3])
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(s)
  if (m) return iso(+m[3], +m[2], +m[1])
  m = /^[A-Za-z]{3} ([A-Za-z]{3}) (\d{1,2}) (\d{4})/.exec(s)
  if (m && MONTH_ABBR[m[1]]) return iso(+m[3], MONTH_ABBR[m[1]], +m[2])
  return null
}

function parseNumber(value: unknown): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value.trim().replace(",", "."))
        : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

function parsePosition(value: unknown): MeasurementPosition {
  const s = String(value ?? "")
    .trim()
    .toLowerCase()
  if (s.startsWith("ber")) return "STANDING"
  if (s.startsWith("ter") || s.startsWith("tel")) return "RECUMBENT"
  return "UNKNOWN"
}

const blank = (v: unknown) => v === null || v === undefined || v === ""

describe.skipIf(!FILE)("rumus z-score Excel Bu Bidan vs mesin OpenASP", () => {
  it("setiap baris sama dengan mesin antropometri", async () => {
    const refs = await loadWho2006References()
    const dump = JSON.parse(readFileSync(FILE!, "utf8")) as Record<
      string,
      SheetDump
    >
    const sheetRows = (name: string) => {
      expect(dump[name], `sheet ${name} ada di JSON`).toBeDefined()
      expect(dump[name].firstCol).toBe(1)
      return dump[name].rows
    }

    // Data induk yang dipakai rumus: NIK -> tanggal lahir dan jenis kelamin.
    // Header 'Tambah Balita' ada di baris 2, yang juga baris pertama rentang terpakai.
    const parentRows = sheetRows("Tambah Balita")
    const parentHeader = (parentRows[0] ?? []).map((h) =>
      String(h ?? "")
        .trim()
        .toLowerCase()
    )
    const pc = (name: string) => parentHeader.indexOf(name)
    const parents = new Map<
      string,
      { birth: string | null; sex: "M" | "F" | null }
    >()
    for (const row of parentRows.slice(1)) {
      const nik = String(row[pc("nik")] ?? "").trim()
      if (!nik) continue
      const sexText = String(row[pc("jenis_kelamin")] ?? "")
        .trim()
        .toUpperCase()
      parents.set(nik, {
        birth: parseDate(row[pc("tgl_lahir")]),
        sex: sexText.startsWith("L")
          ? "M"
          : sexText.startsWith("P")
            ? "F"
            : null,
      })
    }

    const stats = {
      rows: 0,
      compared: 0,
      noParent: 0,
      blankBoth: 0,
      structural: [] as string[],
      sexMismatch: 0,
      ageMismatch: 0,
      statusMismatch: [] as string[],
      stuntingMismatch: 0,
      /** Cakupan cabang rumus yang jarang muncul di data nyata (dari keluaran mesin). */
      branch: {
        umurDiLuarRentang: 0,
        stunting: 0,
        sangatPendek: 0,
        wazDiLuar3SD: 0,
        whzDiLuar3SD: 0,
        tabelPanjang: 0,
        tabelTinggi: 0,
        koreksiNaik: 0,
        koreksiTurun: 0,
        bayiBerdiriTanpaKoreksi: 0,
      },
      maxDiff: { haz: 0, waz: 0, whz: 0 },
      /** Berapa z-score yang benar-benar dibandingkan (kedua sisi berisi angka) per indikator. */
      numeric: { haz: 0, waz: 0, whz: 0 },
      tiesOff: 0,
    }

    for (const name of MONTH_SHEETS) {
      expect(dump[name]?.firstRow, `${name}: header di baris 1`).toBe(1)
      const rows = sheetRows(name)
      const header = (rows[0] ?? []).map((h) => String(h ?? "").trim())
      const col = (h: string) => header.indexOf(h)
      const need = [
        "NIK",
        "TANGGALUKUR",
        "BERAT",
        "TINGGI",
        "CARAUKUR",
        "JK",
        "UMUR (bln)",
        "Z TB/U",
        "Z BB/U",
        "Z BB/TB",
        "STATUS TB/U",
        "STATUS BB/U",
        "STATUS BB/TB",
        "STUNTING?",
      ]
      for (const h of need)
        expect(col(h), `${name}: kolom ${h}`).toBeGreaterThan(-1)

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r]
        const nik = String(row[col("NIK")] ?? "").trim()
        if (!nik) continue
        stats.rows++
        const where = `${name}!baris ${r + 1}`

        const parent = parents.get(nik)
        const ownBirth =
          col("TANGGAL LAHIR") > -1
            ? parseDate(row[col("TANGGAL LAHIR")])
            : null
        const birth = ownBirth ?? parent?.birth ?? null
        const sex = parent?.sex ?? null
        const measuredAt = parseDate(row[col("TANGGALUKUR")])
        const weight = parseNumber(row[col("BERAT")])
        const height = parseNumber(row[col("TINGGI")])
        if (!parent) stats.noParent++

        // JK hasil pencarian rumus harus sama dengan data induk.
        const sheetSex = row[col("JK")]
        if ((sheetSex ?? "") !== (sex === "M" ? "L" : sex === "F" ? "P" : "")) {
          stats.sexMismatch++
          if (stats.structural.length < 8) stats.structural.push(`${where}: JK`)
        }

        if (!birth || !measuredAt || !sex) {
          // Tanpa data induk lengkap, rumus tidak boleh menghasilkan z-score.
          for (const h of ["Z TB/U", "Z BB/U", "Z BB/TB"]) {
            if (!blank(row[col(h)]))
              stats.structural.push(`${where}: ${h} terisi tanpa data induk`)
          }
          continue
        }

        const result = computeAnthropometry(
          {
            sex,
            birthDate: birth,
            measuredAt,
            weightKg: weight,
            rawLengthHeightCm: height,
            position: parsePosition(row[col("CARAUKUR")]),
            pittingEdema: "NONE",
          },
          refs
        )
        stats.compared++
        const b = stats.branch
        if (result.flags.includes("AGE_OUT_OF_RANGE")) b.umurDiLuarRentang++
        if (result.haz !== null && result.haz < -2) b.stunting++
        if (result.haz !== null && result.haz < -3) b.sangatPendek++
        if (result.waz !== null && Math.abs(result.waz) > 3) b.wazDiLuar3SD++
        if (result.whz !== null && Math.abs(result.whz) > 3) b.whzDiLuar3SD++
        if (result.whzTable === "WFL") b.tabelPanjang++
        if (result.whzTable === "WFH") b.tabelTinggi++
        if (result.flags.includes("POSITION_CORRECTED_UP")) b.koreksiNaik++
        if (result.flags.includes("POSITION_CORRECTED_DOWN")) b.koreksiTurun++
        if (result.flags.includes("STANDING_UNDER_9_MONTHS"))
          b.bayiBerdiriTanpaKoreksi++

        // Umur (bulan penuh).
        if (result.ageInMonthsExact !== null) {
          const age = row[col("UMUR (bln)")]
          if (age !== Math.floor(result.ageInMonthsExact)) stats.ageMismatch++
        }

        const pairs: [
          string,
          number | null,
          "haz" | "waz" | "whz",
          NutritionCategory | null,
          string,
        ][] = [
          ["Z TB/U", result.haz, "haz", result.hazCategory, "STATUS TB/U"],
          ["Z BB/U", result.waz, "waz", result.wazCategory, "STATUS BB/U"],
          ["Z BB/TB", result.whz, "whz", result.whzCategory, "STATUS BB/TB"],
        ]
        for (const [zHeader, expected, key, category, statusHeader] of pairs) {
          const actual = row[col(zHeader)]
          if (expected === null) {
            if (!blank(actual)) {
              stats.structural.push(
                `${where}: ${zHeader} terisi (${actual}) padahal mesin null`
              )
            } else stats.blankBoth++
            continue
          }
          if (typeof actual !== "number") {
            stats.structural.push(
              `${where}: ${zHeader} kosong padahal mesin ${expected}`
            )
            continue
          }
          const diff = Math.abs(actual - expected)
          stats.numeric[key]++
          if (diff > stats.maxDiff[key]) stats.maxDiff[key] = diff
          if (diff > 0) stats.tiesOff++
          const label = category ? CATEGORY_LABELS[category] : ""
          if (row[col(statusHeader)] !== label) {
            stats.statusMismatch.push(
              `${where}: ${statusHeader} excel=${row[col(statusHeader)]} mesin=${label}`
            )
          }
        }

        if (result.haz !== null) {
          const expectedStunting = result.haz < -2 ? "YA" : "TIDAK"
          if (row[col("STUNTING?")] !== expectedStunting)
            stats.stuntingMismatch++
        }
      }
    }

    console.log(
      JSON.stringify(
        {
          barisBerNIK: stats.rows,
          dibandingkan: stats.compared,
          tanpaDataInduk: stats.noParent,
          zDibandingkan: stats.numeric,
          cabang: stats.branch,
          selisihZMaks: stats.maxDiff,
          zBerbedaDesimal: stats.tiesOff,
          jkBeda: stats.sexMismatch,
          umurBeda: stats.ageMismatch,
          stuntingBeda: stats.stuntingMismatch,
          strukturalContoh: stats.structural.slice(0, 8),
          statusBedaContoh: stats.statusMismatch.slice(0, 8),
        },
        null,
        2
      )
    )

    expect(stats.compared).toBeGreaterThan(0)
    // Tes tidak boleh lulus karena tidak ada yang dibandingkan.
    expect(stats.numeric.haz).toBeGreaterThan(0)
    expect(stats.numeric.waz).toBeGreaterThan(0)
    expect(stats.numeric.whz).toBeGreaterThan(0)
    expect(stats.structural).toEqual([])
    expect(stats.sexMismatch).toBe(0)
    expect(stats.ageMismatch).toBe(0)
    expect(stats.statusMismatch).toEqual([])
    expect(stats.stuntingMismatch).toBe(0)
    // Pembulatan di titik tengah boleh berbeda satu langkah (0,01) antara Excel dan JavaScript.
    expect(Math.max(...Object.values(stats.maxDiff))).toBeLessThanOrEqual(0.011)
  })
})
