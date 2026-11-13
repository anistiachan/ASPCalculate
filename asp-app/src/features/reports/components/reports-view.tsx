"use client"

import Link from "next/link"
import { Suspense, use, useMemo, useState } from "react"

import { ErrorBoundary } from "@/components/molecules/error-boundary"
import { ValidationNotice } from "@/components/molecules/validation-notice"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { describeReferenceVersion } from "@/domain/anthropometry/references/reference"
import { loadWho2006References } from "@/domain/anthropometry/references/load-who-2006"
import { monthKeyOf, type MonthKey } from "@/domain/reporting/monthly-recap"
import { formatMonth } from "@/lib/format/format"
import { useToday } from "@/lib/hooks/use-today"

import { useReportData, type ReportData } from "../hooks/use-report-data"
import { computeRecapForMonth } from "../services/recap-for-month"
import {
  ALL_POSYANDU,
  filterByPosyandu,
  posyanduOptions,
} from "../services/posyandu-filter"
import { computeSkdnForMonth } from "../services/skdn-for-month"
import { yearOptions } from "../services/year-options"
import { CoverageSummary } from "./coverage-summary"
import { DefinitionsNotice } from "./definitions-notice"
import { ExportRecapButton } from "./export-recap-button"
import { MonthPicker } from "./month-picker"
import { PosyanduPicker } from "./posyandu-picker"
import { SkdnSummary } from "./skdn-summary"
import { StatusDistribution } from "./status-distribution"
import { VitaminASummary } from "./vitamin-a-summary"

function LoadingSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Memuat laporan">
      <Skeleton className="h-16 w-full max-w-md" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
}

function EmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Belum ada data untuk dilaporkan</CardTitle>
        <CardDescription>
          Laporan dibuat dari data balita dan pengukuran di perangkat ini.
          Tambahkan atau impor data terlebih dahulu.
        </CardDescription>
      </CardHeader>
      <div className="flex flex-wrap gap-2 px-4">
        <Button asChild>
          <Link href="/children/new">Tambah balita</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/import">Import Excel</Link>
        </Button>
      </div>
    </Card>
  )
}

export function ReportsView() {
  const today = useToday()
  const data = useReportData()
  const [selected, setSelected] = useState<MonthKey | null>(null)
  const [posyanduChoice, setPosyanduChoice] = useState(ALL_POSYANDU)

  if (today === null || data === undefined) return <LoadingSkeleton />
  if (data.children.length === 0) return <EmptyState />

  const currentMonth = monthKeyOf(today)
  const month = selected ?? currentMonth
  const posyanduNames = posyanduOptions(data.children)
  // Pilihan yang sudah tidak ada pada data (mis. anaknya dihapus) kembali ke semua Posyandu.
  const posyandu = posyanduNames.includes(posyanduChoice)
    ? posyanduChoice
    : ALL_POSYANDU
  const scoped = filterByPosyandu(data, posyandu)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <MonthPicker
          month={month}
          currentMonth={currentMonth}
          years={yearOptions(data.measurements, today)}
          onChange={setSelected}
        />
        <PosyanduPicker
          options={posyanduNames}
          value={posyandu}
          onChange={setPosyanduChoice}
        />
      </div>

      <ErrorBoundary
        fallback={
          <p role="status" className="text-base text-muted-foreground">
            Tabel referensi WHO tidak dapat dimuat. Periksa koneksi lalu muat
            ulang halaman.
          </p>
        }
      >
        <Suspense fallback={<LoadingSkeleton />}>
          <RecapSections
            month={month}
            data={scoped}
            posyandu={posyandu === ALL_POSYANDU ? null : posyandu}
          />
        </Suspense>
      </ErrorBoundary>

      <DefinitionsNotice />
    </div>
  )
}

function RecapSections({
  month,
  data,
  posyandu,
}: {
  month: MonthKey
  data: ReportData
  posyandu: string | null
}) {
  // Promise di-cache di modul, jadi `use` tidak membuat permintaan berulang.
  const refs = use(loadWho2006References())
  const recap = useMemo(
    () => computeRecapForMonth(month, data.children, data.measurements, refs),
    [month, data, refs]
  )

  const skdn = useMemo(
    () => computeSkdnForMonth(month, data.children, data.measurements),
    [month, data]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-heading text-2xl font-semibold">
          Rekap {formatMonth(month)}
        </h2>
        <ExportRecapButton
          recap={recap}
          skdn={skdn}
          posyandu={posyandu}
          referenceVersion={describeReferenceVersion(refs.metadata)}
        />
      </div>

      <CoverageSummary recap={recap} />

      <SkdnSummary skdn={skdn} />

      <section aria-labelledby="status-heading" className="space-y-3">
        <h2 id="status-heading" className="font-heading text-2xl font-semibold">
          Status gizi
        </h2>
        <ValidationNotice />
        <StatusDistribution recap={recap} />
      </section>

      <VitaminASummary recap={recap} />
    </div>
  )
}
