"use client"

import Link from "next/link"
import { Suspense, use, useMemo } from "react"

import { ErrorBoundary } from "@/components/molecules/error-boundary"
import { StatCard } from "@/components/molecules/stat-card"
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
import { loadWho2006References } from "@/domain/anthropometry/references/load-who-2006"
import {
  buildCoverageSeries,
  buildOverview,
  monthKeyOf,
  recentMonths,
  type MonthKey,
} from "@/domain/reporting/monthly-recap"
import { formatMonth, formatPercent } from "@/lib/format/format"
import { useToday } from "@/lib/hooks/use-today"

import { useReportData, type ReportData } from "../hooks/use-report-data"
import { computeRecapForMonth } from "../services/recap-for-month"
import { StatusDistribution } from "./status-distribution"
import { WeighingTrendChart } from "./weighing-trend-chart"

const TREND_MONTHS = 12

function LoadingSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Memuat dashboard">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  )
}

function EmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Belum ada data balita</CardTitle>
        <CardDescription>
          Dashboard terisi setelah ada data. Tambahkan balita satu per satu atau
          impor dari file Excel Bu Bidan. Data disimpan di perangkat ini.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/children/new">Tambah balita</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/import">Import Excel</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export function DashboardView() {
  const today = useToday()
  const data = useReportData()

  if (today === null || data === undefined) return <LoadingSkeleton />
  if (data.children.length === 0) return <EmptyState />

  return <DashboardContent month={monthKeyOf(today)} data={data} />
}

function DashboardContent({
  month,
  data,
}: {
  month: MonthKey
  data: ReportData
}) {
  const overview = useMemo(
    () => buildOverview(month, data.children, data.measurements),
    [month, data]
  )
  const series = useMemo(
    () =>
      buildCoverageSeries(
        recentMonths(month, TREND_MONTHS),
        data.children,
        data.measurements
      ),
    [month, data]
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Balita terdata"
          value={overview.totalChildren}
          hint="Semua anak di aplikasi ini"
          tone="sky"
        />
        <StatCard
          label="Balita 0–59 bulan"
          value={overview.eligibleThisMonth}
          hint={`Pada ${formatMonth(month)}`}
          tone="green"
        />
        <StatCard
          label="Ditimbang bulan ini"
          value={overview.weighedThisMonth}
          hint={`${formatPercent(overview.weighedThisMonth, overview.eligibleThisMonth)} dari balita 0–59 bulan`}
          tone="butter"
        />
        <StatCard
          label="Belum pernah diukur"
          value={overview.neverMeasured}
          hint="Anak tanpa satu pun pengukuran"
          tone={overview.neverMeasured > 0 ? "pink" : "neutral"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="font-heading text-xl font-semibold">
              Balita ditimbang per bulan
            </h2>
          </CardTitle>
          <CardDescription>
            Jumlah balita 0–59 bulan yang punya pengukuran berat, 12 bulan
            terakhir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WeighingTrendChart points={series} />
        </CardContent>
      </Card>

      <section aria-labelledby="dashboard-status-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="dashboard-status-heading"
            className="font-heading text-2xl font-semibold"
          >
            Status gizi {formatMonth(month)}
          </h2>
          <Button asChild variant="outline">
            <Link href="/reports">Lihat laporan lengkap</Link>
          </Button>
        </div>
        <ValidationNotice />
        <ErrorBoundary
          fallback={
            <p role="status" className="text-base text-muted-foreground">
              Tabel referensi WHO tidak dapat dimuat. Periksa koneksi lalu muat
              ulang halaman.
            </p>
          }
        >
          <Suspense fallback={<Skeleton className="h-72 w-full" />}>
            <StatusSection month={month} data={data} />
          </Suspense>
        </ErrorBoundary>
      </section>
    </div>
  )
}

function StatusSection({ month, data }: { month: MonthKey; data: ReportData }) {
  // Promise di-cache di modul, jadi `use` tidak membuat permintaan berulang.
  const refs = use(loadWho2006References())
  const recap = useMemo(
    () => computeRecapForMonth(month, data.children, data.measurements, refs),
    [month, data, refs]
  )
  return <StatusDistribution recap={recap} />
}
