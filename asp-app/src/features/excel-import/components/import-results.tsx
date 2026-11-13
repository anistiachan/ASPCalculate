"use client"

import Link from "next/link"
import { Suspense, use, useMemo, useState } from "react"

import { ErrorBoundary } from "@/components/molecules/error-boundary"
import { FormField } from "@/components/molecules/form-field"
import { NativeSelect } from "@/components/molecules/native-select"
import { ValidationNotice } from "@/components/molecules/validation-notice"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  CATEGORY_LABELS,
  type NutritionCategory,
} from "@/domain/anthropometry/classification"
import { ANTHROPOMETRY_VALIDATED_BY_HEALTH_PROFESSIONAL } from "@/domain/anthropometry/constants"
import { loadWho2006References } from "@/domain/anthropometry/references/load-who-2006"
import { hasAbnormalStatus } from "@/domain/reporting/lists"
import type { MonthKey } from "@/domain/reporting/monthly-recap"
import { useReportData } from "@/features/reports/hooks/use-report-data"
import { ExportWorkbookButton } from "@/features/reports/components/export-workbook-button"
import { computeListsForMonth } from "@/features/reports/services/lists-for-month"
import { todayIso } from "@/lib/date/completed-months"
import { formatMonth, formatZScore } from "@/lib/format/format"

import type { ValidatedBatch } from "../validators/validate-batch"

const MAX_ROWS = 30

const category = (label: NutritionCategory | null, z: number | null) =>
  label === null ? "–" : `${CATEGORY_LABELS[label]} (${formatZScore(z)})`

/**
 * Hasil pemeriksaan setelah impor disimpan: status gizi dihitung dari data yang baru masuk,
 * anak yang tidak normal dan data yang dicurigai salah diberi tahu, lalu hasilnya (dengan
 * z-score dan status gizi) bisa diunduh. Hanya anak dari berkas ini yang dihitung.
 */
export function ImportResults({ validated }: { validated: ValidatedBatch }) {
  const months = useMemo(
    () =>
      [
        ...new Set(validated.measurements.map((m) => m.measuredAt.slice(0, 7))),
      ].sort((a, b) => b.localeCompare(a)) as MonthKey[],
    [validated]
  )
  if (months.length === 0) return null

  return (
    <ErrorBoundary
      fallback={
        <p role="status" className="text-base text-muted-foreground">
          Tabel referensi WHO tidak dapat dimuat. Hasil pemeriksaan tersedia di
          halaman Daftar Pantauan setelah dimuat ulang.
        </p>
      }
    >
      <Suspense
        fallback={
          <div role="status" aria-label="Memeriksa data">
            <Skeleton className="h-40 w-full" />
          </div>
        }
      >
        <ResultsBody validated={validated} months={months} />
      </Suspense>
    </ErrorBoundary>
  )
}

function ResultsBody({
  validated,
  months,
}: {
  validated: ValidatedBatch
  months: MonthKey[]
}) {
  const refs = use(loadWho2006References())
  const data = useReportData()
  const [chosen, setChosen] = useState<MonthKey | null>(null)
  const month = chosen ?? months[0]

  const scoped = useMemo(() => {
    if (!data) return null
    const keys = new Set(validated.children.map((c) => c.sourceKey))
    const children = data.children.filter((child) => {
      const key = child.importKey ?? child.sourceKey
      return key !== null && keys.has(key)
    })
    const ids = new Set(children.map((c) => c.id))
    return {
      children,
      measurements: data.measurements.filter((m) => ids.has(m.childId)),
    }
  }, [data, validated])

  const lists = useMemo(
    () =>
      scoped
        ? computeListsForMonth(
            month,
            scoped.children,
            scoped.measurements,
            refs
          )
        : null,
    [scoped, month, refs]
  )

  if (!lists) {
    return (
      <div role="status" aria-label="Memeriksa data">
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const { status, recheck } = lists
  const reasonsByChild = new Map(
    recheck.map((entry) => [
      entry.childId,
      entry.reasons.map((reason) => reason.message),
    ])
  )
  const attention = status.all.filter(
    (entry) =>
      reasonsByChild.has(entry.childId) ||
      hasAbnormalStatus(entry) ||
      status.lists.BERMASALAH.includes(entry) ||
      status.lists.BBK.includes(entry)
  )
  const shown = attention.slice(0, MAX_ROWS)

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="font-heading text-xl font-semibold">
            Hasil pemeriksaan · {formatMonth(month)}
          </h2>
        </CardTitle>
        <CardDescription>
          Status gizi dihitung dari data yang baru disimpan (WHO 2006 dan
          Permenkes 2/2020). {status.all.length} anak diperiksa,{" "}
          {attention.length} perlu perhatian. Unduh hasilnya untuk melihat
          z-score dan status gizi semua anak.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ValidationNotice />

        {months.length > 1 && (
          <FormField label="Bulan diperiksa">
            {(a11y) => (
              <NativeSelect
                {...a11y}
                value={month}
                onChange={(event) => setChosen(event.target.value as MonthKey)}
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {formatMonth(m)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
        )}

        {attention.length === 0 ? (
          <p className="text-base">
            Semua anak yang diperiksa berstatus normal dan tidak ada data yang
            dicurigai salah.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead className="hidden md:table-cell">Posyandu</TableHead>
                <TableHead>TB/U</TableHead>
                <TableHead>BB/U</TableHead>
                <TableHead>BB/PB-TB</TableHead>
                <TableHead>Catatan data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((entry) => (
                <TableRow key={entry.childId}>
                  <TableCell className="font-semibold whitespace-normal">
                    <Link
                      href={`/children/${entry.childId}`}
                      className="underline underline-offset-2"
                    >
                      {entry.name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {entry.posyandu ?? "–"}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {category(entry.hazCategory, entry.haz)}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {category(entry.wazCategory, entry.waz)}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {category(entry.whzCategory, entry.whz)}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {(reasonsByChild.get(entry.childId) ?? []).join(" ") || "–"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {attention.length > shown.length && (
          <p className="text-sm text-muted-foreground">
            Dan {attention.length - shown.length} anak lainnya. Lihat semuanya
            di Daftar Pantauan atau pada berkas unduhan.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <ExportWorkbookButton
            label="Unduh hasil PSG dengan z-score dan status (memuat nama dan tanggal lahir)"
            fileName={`psg-hasil-${month}.xlsx`}
            disabled={status.all.length === 0}
            build={async () => {
              const { buildPsgWorkbook } =
                await import("@/infrastructure/excel/psg-workbook")
              return buildPsgWorkbook(
                month,
                status,
                {
                  generatedOn: todayIso(),
                  validated: ANTHROPOMETRY_VALIDATED_BY_HEALTH_PROFESSIONAL,
                },
                recheck
              )
            }}
          />
          <ExportWorkbookButton
            label="Unduh daftar ukur ulang (memuat nama anak)"
            fileName={`ukur-ulang-${month}.xlsx`}
            disabled={recheck.length === 0}
            build={async () => {
              const { buildRecheckWorkbook } =
                await import("@/infrastructure/excel/recheck-workbook")
              return buildRecheckWorkbook(month, recheck, {
                generatedOn: todayIso(),
              })
            }}
          />
          <Button asChild variant="outline">
            <Link href="/lists">Buka Daftar Pantauan</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
