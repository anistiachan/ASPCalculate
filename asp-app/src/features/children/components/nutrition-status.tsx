"use client"

import { Suspense, use, useMemo } from "react"

import { ErrorBoundary } from "@/components/molecules/error-boundary"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
  CATEGORY_SEVERITY,
  type CategorySeverity,
  type NutritionCategory,
} from "@/domain/anthropometry/classification"
import { ANTHROPOMETRY_VALIDATED_BY_HEALTH_PROFESSIONAL } from "@/domain/anthropometry/constants"
import { loadWho2006References } from "@/domain/anthropometry/references/load-who-2006"
import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"
import { formatShortDate, formatZScore } from "@/lib/format/format"

import { FLAG_LABELS } from "../labels"
import { computeNutritionResults } from "../services/nutrition-results"

const BADGE_BY_SEVERITY = {
  ok: "success",
  watch: "warning",
  alert: "destructive",
} as const satisfies Record<CategorySeverity, string>

/** Satu sel indikator: z-score (angka) dan kategori (teks, dengan warna sebagai pendukung). */
function IndicatorCell({
  z,
  category,
}: {
  z: number | null
  category: NutritionCategory | null
}) {
  if (z === null || category === null) {
    return <span className="text-muted-foreground">–</span>
  }
  return (
    <div className="space-y-1">
      <div className="font-mono">{formatZScore(z)}</div>
      <Badge variant={BADGE_BY_SEVERITY[CATEGORY_SEVERITY[category]]}>
        {CATEGORY_LABELS[category]}
      </Badge>
    </div>
  )
}

function ValidationNotice() {
  if (ANTHROPOMETRY_VALIDATED_BY_HEALTH_PROFESSIONAL) return null
  return (
    <Alert variant="warning" role="note">
      <AlertTitle>Hasil masih dalam tahap uji</AlertTitle>
      <AlertDescription>
        Perhitungan ini belum divalidasi oleh tenaga kesehatan dan tidak boleh
        dipakai untuk keputusan layanan gizi. Pastikan hasil penting
        dikonfirmasi dengan tenaga gizi atau kesehatan yang berwenang.
      </AlertDescription>
    </Alert>
  )
}

function Fallback({ message }: { message: string }) {
  return (
    <p className="px-4 text-base text-muted-foreground" role="status">
      {message}
    </p>
  )
}

/**
 * Status gizi seluruh pengukuran seorang anak. Tabel referensi (±300 KB) dimuat saat
 * bagian ini ditampilkan, bukan di bundle awal.
 */
export function NutritionStatus({
  child,
  measurements,
}: {
  child: StoredChild
  measurements: StoredMeasurement[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Status gizi</CardTitle>
        <CardDescription>
          Standar antropometri anak: Permenkes No. 2 Tahun 2020 dengan acuan WHO
          Child Growth Standards 2006. Z-score dibulatkan 2 desimal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-0">
        <div className="px-4">
          <ValidationNotice />
        </div>
        {measurements.length === 0 ? (
          <Fallback message="Status gizi muncul setelah ada pengukuran." />
        ) : (
          <ErrorBoundary
            fallback={
              <Fallback message="Tabel referensi WHO tidak dapat dimuat. Periksa koneksi lalu muat ulang halaman." />
            }
          >
            <Suspense fallback={<NutritionStatusSkeleton />}>
              <ResultsTable child={child} measurements={measurements} />
            </Suspense>
          </ErrorBoundary>
        )}
      </CardContent>
    </Card>
  )
}

function ResultsTable({
  child,
  measurements,
}: {
  child: StoredChild
  measurements: StoredMeasurement[]
}) {
  // Promise di-cache di modul, jadi `use` tidak membuat permintaan berulang.
  const refs = use(loadWho2006References())
  const rows = useMemo(
    () => computeNutritionResults(child, measurements, refs),
    [child, measurements, refs]
  )

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tanggal ukur</TableHead>
            <TableHead>
              <abbr title="Berat badan menurut umur">BB/U</abbr>
            </TableHead>
            <TableHead>
              <abbr title="Panjang atau tinggi badan menurut umur">TB/U</abbr>
            </TableHead>
            <TableHead>
              <abbr title="Berat badan menurut panjang atau tinggi badan">
                BB/PB-TB
              </abbr>
            </TableHead>
            <TableHead>
              <abbr title="Indeks massa tubuh menurut umur">IMT/U</abbr>
            </TableHead>
            <TableHead>Catatan</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ measurement, result }) => (
            <TableRow key={measurement.id}>
              <TableCell className="align-top font-semibold">
                {formatShortDate(measurement.measuredAt)}
              </TableCell>
              <TableCell className="align-top">
                <IndicatorCell z={result.waz} category={result.wazCategory} />
              </TableCell>
              <TableCell className="align-top">
                <IndicatorCell z={result.haz} category={result.hazCategory} />
              </TableCell>
              <TableCell className="align-top">
                <IndicatorCell z={result.whz} category={result.whzCategory} />
              </TableCell>
              <TableCell className="align-top">
                <IndicatorCell z={result.baz} category={result.bazCategory} />
              </TableCell>
              <TableCell className="min-w-64 align-top whitespace-normal">
                {result.flags.length === 0 ? (
                  <span className="text-muted-foreground">–</span>
                ) : (
                  <ul className="list-disc space-y-1 pl-4 text-sm">
                    {result.flags.map((flag) => (
                      <li key={flag}>{FLAG_LABELS[flag]}</li>
                    ))}
                  </ul>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="px-4 text-sm text-muted-foreground">
        Algoritma {rows[0]?.result.algorithmVersion} · Referensi{" "}
        {rows[0]?.result.referenceDataVersion}
      </p>
    </>
  )
}

/** Kerangka saat tabel referensi sedang dimuat. */
export function NutritionStatusSkeleton() {
  return (
    <div
      className="space-y-3 px-4"
      role="status"
      aria-label="Memuat status gizi"
    >
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}
