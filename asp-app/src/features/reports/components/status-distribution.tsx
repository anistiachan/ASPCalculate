"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CATEGORY_LABELS } from "@/domain/anthropometry/classification"
import type {
  IndicatorBreakdown,
  MonthlyRecap,
  SexGroup,
} from "@/domain/reporting/monthly-recap"
import {
  GROUP_LABELS,
  GROUP_OF,
  GROUP_ORDER,
  INDICATOR_CATEGORIES,
  INDICATOR_NAMES,
  STATUS_INDICATORS,
  type StatusGroup,
  type StatusIndicator,
} from "@/domain/reporting/status-groups"
import { formatPercent } from "@/lib/format/format"

import { SegmentedBar } from "./segmented-bar"

/** Warna kutub diverging: biru ← abu-abu netral → oranye (divalidasi, lihat globals.css). */
const GROUP_COLOR: Record<StatusGroup, string> = {
  UNDER: "var(--viz-under)",
  NORMAL: "var(--viz-normal)",
  OVER: "var(--viz-over)",
}

// Di layar sempit rincian per jenis kelamin disembunyikan agar jumlah dan persen (yang
// terpenting) tetap terlihat tanpa menggeser tabel; rinciannya ada di layar yang lebih lebar
// dan di berkas Excel.
const SEX_HEAD = "hidden text-right md:table-cell"
const SEX_CELL = "hidden text-right font-mono md:table-cell"
const NUMBER_CELL = "text-right font-mono"

function IndicatorCard({
  indicator,
  breakdown,
}: {
  indicator: StatusIndicator
  breakdown: Record<SexGroup, IndicatorBreakdown>
}) {
  const names = INDICATOR_NAMES[indicator]
  const all = breakdown.ALL
  const categories = INDICATOR_CATEGORIES[indicator]
  // Belum ada satu pun anak yang diukur bulan ini: tabel berisi nol semua tidak informatif.
  const isEmpty = all.assessed === 0 && all.notAssessed === 0

  const segments = GROUP_ORDER.map((group) => ({
    key: group,
    label: GROUP_LABELS[indicator][group],
    color: GROUP_COLOR[group],
    count: categories
      .filter((category) => GROUP_OF[category] === group)
      .reduce((sum, category) => sum + (all.counts[category] ?? 0), 0),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3 className="font-heading text-xl font-semibold">{names.short}</h3>
        </CardTitle>
        <CardDescription>
          {names.full}.{" "}
          {all.assessed === 0
            ? "Belum ada anak yang dinilai."
            : `${all.assessed} anak dinilai.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isEmpty ? (
          <p className="text-base text-muted-foreground">
            Tidak ada pengukuran pada bulan ini.
          </p>
        ) : (
          <>
            <SegmentedBar
              segments={segments}
              ariaLabel={`Sebaran ${names.short}: kurang, normal, lebih`}
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategori</TableHead>
                  <TableHead className={SEX_HEAD}>Laki-laki</TableHead>
                  <TableHead className={SEX_HEAD}>Perempuan</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="text-right">Persen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category}>
                    <TableCell className="whitespace-normal">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="size-3 shrink-0 rounded-sm"
                          style={{
                            background: GROUP_COLOR[GROUP_OF[category]],
                          }}
                        />
                        {CATEGORY_LABELS[category]}
                      </span>
                    </TableCell>
                    <TableCell className={SEX_CELL}>
                      {breakdown.M.counts[category] ?? 0}
                    </TableCell>
                    <TableCell className={SEX_CELL}>
                      {breakdown.F.counts[category] ?? 0}
                    </TableCell>
                    <TableCell className={NUMBER_CELL}>
                      {all.counts[category] ?? 0}
                    </TableCell>
                    <TableCell className={NUMBER_CELL}>
                      {formatPercent(all.counts[category] ?? 0, all.assessed)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell>Dinilai</TableCell>
                  <TableCell className={SEX_CELL}>
                    {breakdown.M.assessed}
                  </TableCell>
                  <TableCell className={SEX_CELL}>
                    {breakdown.F.assessed}
                  </TableCell>
                  <TableCell className={NUMBER_CELL}>{all.assessed}</TableCell>
                  <TableCell />
                </TableRow>
                <TableRow>
                  <TableCell className="whitespace-normal">
                    Tidak dapat dihitung
                  </TableCell>
                  <TableCell className={SEX_CELL}>
                    {breakdown.M.notAssessed}
                  </TableCell>
                  <TableCell className={SEX_CELL}>
                    {breakdown.F.notAssessed}
                  </TableCell>
                  <TableCell className={NUMBER_CELL}>
                    {all.notAssessed}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** Sebaran status gizi seluruh indikator untuk satu bulan. */
export function StatusDistribution({ recap }: { recap: MonthlyRecap }) {
  // Satu kolom: tabel lima kolom terlalu sempit bila kartu dibagi dua, dan nama kategori
  // seperti "Berat badan sangat kurang" pecah menjadi beberapa baris.
  return (
    <div className="grid gap-4">
      {STATUS_INDICATORS.map((indicator) => (
        <IndicatorCard
          key={indicator}
          indicator={indicator}
          breakdown={recap.status[indicator]}
        />
      ))}
    </div>
  )
}
