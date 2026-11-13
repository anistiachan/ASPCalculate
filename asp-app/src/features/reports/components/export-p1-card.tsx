"use client"

import { useState } from "react"

import { FormField } from "@/components/molecules/form-field"
import { NativeSelect } from "@/components/molecules/native-select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ANTHROPOMETRY_VALIDATED_BY_HEALTH_PROFESSIONAL } from "@/domain/anthropometry/constants"
import { todayIso } from "@/lib/date/completed-months"
import { useToday } from "@/lib/hooks/use-today"

import type { ReportData } from "../hooks/use-report-data"
import { posyanduSlug } from "../services/posyandu-filter"
import { yearOptions } from "../services/year-options"
import { ExportWorkbookButton } from "./export-workbook-button"

type ExportP1CardProps = {
  data: ReportData
  /** Tahun awal yang dipilih (tahun bulan yang sedang dilihat). */
  defaultYear: number
  /** Nama Posyandu bila disaring; null = semua. */
  posyandu: string | null
}

/**
 * Unduh rekap beberapa bulan sekaligus dalam format sheet Posyandu (P1, P2, …) workbook ASP.
 * Angka apa adanya dari pengukuran tersimpan, termasuk hasil ukur ulang (diberi komentar sel).
 */
export function ExportP1Card({
  data,
  defaultYear,
  posyandu,
}: ExportP1CardProps) {
  const today = useToday()
  const [choice, setChoice] = useState<number | null>(null)
  if (today === null) return null

  const years = yearOptions(data.measurements, today)
  const year = choice ?? defaultYear

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="font-heading text-xl font-semibold">
            Rekap format P1 beberapa bulan
          </h2>
        </CardTitle>
        <CardDescription>
          Satu sheet per Posyandu (P1, P2, …), satu baris per anak, satu blok
          kolom per bulan, seperti sheet Posyandu di workbook ASP. TB hanya
          punya kolom isian untuk Januari, Februari, dan Agustus; bulan lain
          tidak diekspor. Sel hasil ukur ulang diberi komentar.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <FormField label="Periode rekap">
          {(a11y) => (
            <NativeSelect
              {...a11y}
              value={year}
              onChange={(event) => setChoice(Number(event.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <ExportWorkbookButton
          label="Unduh rekap P1 (memuat nama dan tanggal lahir)"
          fileName={`rekap-p1-${year}${posyanduSlug(posyandu)}.xlsx`}
          disabled={data.measurements.length === 0}
          build={async () => {
            const { buildP1Workbook } =
              await import("@/infrastructure/excel/p1-workbook")
            return buildP1Workbook(data.children, data.measurements, {
              generatedOn: todayIso(),
              year,
              validated: ANTHROPOMETRY_VALIDATED_BY_HEALTH_PROFESSIONAL,
            })
          }}
        />
      </CardContent>
    </Card>
  )
}
