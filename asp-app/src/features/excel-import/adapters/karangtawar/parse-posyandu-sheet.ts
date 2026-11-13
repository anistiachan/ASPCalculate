import type {
  ImportedChild,
  ImportedMeasurement,
  ImportIssue,
  SheetData,
  SheetSummary,
} from "../../types"
import { ASI_MAX_AGE } from "@/domain/reporting/lists"
import { calendarAgeMonths } from "@/domain/reporting/skdn"
import { isBlank } from "@/lib/result/parse-result"

import {
  CHILD_COLUMNS,
  columnIndex,
  DEFAULT_MEASURE_DAY,
  FIRST_DATA_ROW,
  LAST_DATA_ROW,
  MONTH_COLUMNS,
} from "./layout"

export type PosyanduParseResult = {
  children: ImportedChild[]
  measurements: ImportedMeasurement[]
  issues: ImportIssue[]
  summaries: SheetSummary[]
}

export const norm = (text: string) =>
  text.trim().toUpperCase().replace(/\s+/g, " ")

export function numberAt(row: unknown[], letters: string): number | null {
  const raw = row[columnIndex(letters)]
  if (isBlank(raw)) return null
  const value =
    typeof raw === "number" ? raw : Number(String(raw).replace(",", "."))
  return Number.isFinite(value) ? value : null
}

export function textAt(row: unknown[], letters: string): string {
  const raw = row[columnIndex(letters)]
  return isBlank(raw) ? "" : String(raw).trim()
}

/**
 * Kode jenis kelamin sheet Posyandu: header kolom O berbunyi "L / P — L = 1, P = 2" dan rumus
 * workbook memakai `$O9=1` untuk laki-laki. Pemetaan ini berlaku khusus format ini; parser
 * umum sengaja menolak kode numerik.
 */
export function parseSexCode(
  raw: unknown
): { ok: true; value: "M" | "F" } | { ok: false; reason: string } {
  const code = typeof raw === "number" ? raw : Number(String(raw ?? "").trim())
  if (code === 1) return { ok: true, value: "M" }
  if (code === 2) return { ok: true, value: "F" }
  return { ok: false, reason: "harus 1 (laki-laki) atau 2 (perempuan)" }
}

export function isoDate(
  year: number,
  month: number,
  day: number
): string | null {
  const date = new Date(Date.UTC(year, month - 1, day))
  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  if (!valid) return null
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** Kunci anak: nama + tanggal lahir + Posyandu. NIK di workbook ini tidak bisa dipakai. */
export function composeImportKey(
  posyandu: string,
  name: string,
  birthDate: string
): string {
  return `KT|${norm(posyandu)}|${norm(name)}|${birthDate}`
}

/**
 * Membaca satu sheet Posyandu: satu baris = satu anak, satu blok kolom = satu bulan.
 * Tanggal ukur hanya diketahui sampai bulan; harinya diambil dari kolom tanggal ukur baris
 * itu (di berkas contoh selalu hari Posyandu yang sama), atau 14 bila tidak ada.
 */
export function parsePosyanduSheet(sheet: SheetData): PosyanduParseResult {
  const children: ImportedChild[] = []
  const measurements: ImportedMeasurement[] = []
  const issues: ImportIssue[] = []
  let rowsRead = 0
  let withoutMeasurement = 0

  const last = Math.min(LAST_DATA_ROW, sheet.rows.length)
  for (let rowNumber = FIRST_DATA_ROW; rowNumber <= last; rowNumber++) {
    const row = sheet.rows[rowNumber - 1] ?? []
    const name = textAt(row, CHILD_COLUMNS.name)
    if (name === "") continue
    rowsRead++

    const source = { sheet: sheet.name, row: rowNumber }
    const report = (
      code: ImportIssue["code"],
      message: string,
      field: string,
      severity: ImportIssue["severity"] = "error"
    ) =>
      issues.push({
        severity,
        code,
        message,
        sheet: sheet.name,
        row: rowNumber,
        field,
      })

    const sexResult = parseSexCode(row[columnIndex(CHILD_COLUMNS.sex)])
    const birthYearTwoDigits = numberAt(row, CHILD_COLUMNS.birthYear)
    const birthMonth = numberAt(row, CHILD_COLUMNS.birthMonth)
    const birthDay = numberAt(row, CHILD_COLUMNS.birthDay)
    const birthDate =
      birthYearTwoDigits !== null && birthMonth !== null && birthDay !== null
        ? isoDate(2000 + birthYearTwoDigits, birthMonth, birthDay)
        : null
    const posyandu = textAt(row, CHILD_COLUMNS.posyandu)

    let rowHasError = false
    if (!sexResult.ok) {
      report("INVALID_VALUE", `Jenis kelamin: ${sexResult.reason}.`, "sex")
      rowHasError = true
    }
    if (birthDate === null) {
      report(
        "INVALID_VALUE",
        "Tanggal lahir tidak lengkap atau tidak valid.",
        "birthDate"
      )
      rowHasError = true
    }
    if (posyandu === "") {
      report("MISSING_VALUE", "Nama Posyandu kosong.", "posyandu")
      rowHasError = true
    }
    if (rowHasError || !sexResult.ok || birthDate === null) continue

    const sourceKey = composeImportKey(posyandu, name, birthDate)
    children.push({
      sourceKey,
      keyKind: "composite",
      posyandu: norm(posyandu),
      name,
      birthDate,
      sex: sexResult.value,
      birthOrder: numberAt(row, CHILD_COLUMNS.birthOrder),
      birthWeightKg: numberAt(row, CHILD_COLUMNS.birthWeightKg),
      birthLengthCm: numberAt(row, CHILD_COLUMNS.birthLengthCm),
      birthHeadCircumferenceCm: null,
      source,
    })

    const referenceYear = numberAt(row, CHILD_COLUMNS.referenceYear)
    if (referenceYear === null) {
      report(
        "MISSING_VALUE",
        "Tahun data pada baris ini kosong; pengukuran tidak diimpor.",
        "year"
      )
      continue
    }
    const dataYear = 2000 + referenceYear
    const dayInput = numberAt(row, CHILD_COLUMNS.firstMeasureDay)
    const day =
      dayInput !== null &&
      Number.isInteger(dayInput) &&
      dayInput >= 1 &&
      dayInput <= 28
        ? dayInput
        : DEFAULT_MEASURE_DAY

    let importedForChild = 0
    for (const column of MONTH_COLUMNS) {
      const weight = numberAt(row, column.weight)
      const height = column.height ? numberAt(row, column.height) : null
      const blue = column.vitaminABlue
        ? numberAt(row, column.vitaminABlue)
        : null
      const red = column.vitaminARed ? numberAt(row, column.vitaminARed) : null
      const vitaminA = blue === 1 || red === 1 ? true : null

      // ASI eksklusif dicatat pada umur anak saat putaran (0–6 bulan): Ya = true, Tdk = false.
      const asiYes = column.asiYes ? numberAt(row, column.asiYes) : null
      const asiNo = column.asiNo ? numberAt(row, column.asiNo) : null
      const breastfeedingByMonth: Record<number, boolean | null> = {}
      const asiAge = calendarAgeMonths(
        birthDate,
        `${dataYear + column.yearOffset}-${String(column.month).padStart(2, "0")}`
      )
      if (
        (asiYes === 1 || asiNo === 1) &&
        asiAge >= 0 &&
        asiAge <= ASI_MAX_AGE
      ) {
        breastfeedingByMonth[asiAge] = asiYes === 1 ? true : false
      }
      const hasAsi = Object.keys(breastfeedingByMonth).length > 0

      const hasWeight = weight !== null && weight !== 0
      const hasHeight = height !== null && height !== 0
      if (!hasWeight && !hasHeight && vitaminA === null && !hasAsi) continue

      const measuredAt = isoDate(
        dataYear + column.yearOffset,
        column.month,
        day
      )
      if (measuredAt === null) continue

      measurements.push({
        sourceChildKey: sourceKey,
        sourceChildName: name,
        birthDateFromSheet: birthDate,
        measuredAt,
        weightKg: hasWeight ? weight : null,
        rawLengthHeightCm: hasHeight ? height : null,
        measurementPosition: "UNKNOWN",
        rawMeasurementPosition: null,
        lilaCm: null,
        headCircumferenceCm: null,
        rawPittingEdema: null,
        vitaminAStatus: vitaminA,
        breastfeedingByMonth,
        motherToddlerClassAttendance: null,
        mbgStatus: null,
        rowNote: null,
        source,
      })
      importedForChild++
    }
    if (importedForChild === 0) withoutMeasurement++
  }

  if (rowsRead > 0) {
    issues.push({
      severity: "warning",
      code: "POSITION_UNKNOWN",
      message:
        "Cara ukur (berdiri/terlentang) tidak tercatat di sheet ini; status TB/U dan BB/TB memakai nilai tanpa koreksi posisi.",
      sheet: sheet.name,
      row: null,
    })
    issues.push({
      severity: "warning",
      code: "INVALID_VALUE",
      message:
        "Tanggal ukur hanya diketahui sampai bulan; hari diperkirakan dari kolom tanggal ukur (atau tanggal 14). Hasil umur dalam hari bersifat perkiraan.",
      sheet: sheet.name,
      row: null,
      field: "measuredAt",
    })
  }

  return {
    children,
    measurements,
    issues,
    summaries:
      rowsRead === 0
        ? []
        : [
            {
              sheet: sheet.name,
              kind: "children",
              rowsRead,
              rowsImported: children.length,
              rowsWithoutMeasurement: 0,
            },
            {
              sheet: sheet.name,
              kind: "measurements",
              rowsRead,
              rowsImported: measurements.length,
              rowsWithoutMeasurement: withoutMeasurement,
            },
          ],
  }
}
