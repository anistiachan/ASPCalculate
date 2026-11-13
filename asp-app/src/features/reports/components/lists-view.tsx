"use client"

import Link from "next/link"
import { Suspense, use, useMemo, useState } from "react"

import { ErrorBoundary } from "@/components/molecules/error-boundary"
import { ValidationNotice } from "@/components/molecules/validation-notice"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { CATEGORY_LABELS } from "@/domain/anthropometry/classification"
import { loadWho2006References } from "@/domain/anthropometry/references/load-who-2006"
import {
  STATUS_LIST_DEFS,
  TARGET_LIST_DEFS,
  type ListedChild,
  type StatusListId,
  type TargetChild,
  type TargetListId,
  type TargetStatus,
} from "@/domain/reporting/lists"
import { monthKeyOf, type MonthKey } from "@/domain/reporting/monthly-recap"
import type { RecheckEntry } from "@/domain/reporting/recheck"
import { ANTHROPOMETRY_VALIDATED_BY_HEALTH_PROFESSIONAL } from "@/domain/anthropometry/constants"
import { todayIso } from "@/lib/date/completed-months"
import {
  formatAgeMonths,
  formatMonth,
  formatNumber,
  formatZScore,
} from "@/lib/format/format"
import { useToday } from "@/lib/hooks/use-today"

import { useReportData, type ReportData } from "../hooks/use-report-data"
import { computeListsForMonth } from "../services/lists-for-month"
import {
  ALL_POSYANDU,
  filterByPosyandu,
  posyanduOptions,
  posyanduSlug,
} from "../services/posyandu-filter"
import { yearOptions } from "../services/year-options"
import { CorrectionsImport } from "./corrections-import"
import { ExportListsButton } from "./export-lists-button"
import { ExportP1Card } from "./export-p1-card"
import { ExportWorkbookButton } from "./export-workbook-button"
import { MonthPicker } from "./month-picker"
import { PosyanduPicker } from "./posyandu-picker"

/** Semua anak yang diukur bulan itu, dengan z-score dan status gizinya (normal maupun tidak). */
const ALL_MEASURED = {
  id: "SEMUA",
  title: "Semua yang diukur",
  definition:
    "Semua balita yang diukur pada bulan ini, lengkap dengan z-score dan status gizinya, termasuk yang normal.",
} as const

type ListChoice = StatusListId | TargetListId | typeof ALL_MEASURED.id

const TARGET_IDS = new Set<string>(TARGET_LIST_DEFS.map((def) => def.id))
const isTarget = (id: ListChoice): id is TargetListId => TARGET_IDS.has(id)

const TARGET_STATUS_LABELS: Record<
  TargetListId,
  Record<TargetStatus, string>
> = {
  VITAMIN_A_BIRU: { YES: "Sudah", NO: "Tidak", UNKNOWN: "Belum tercatat" },
  VITAMIN_A_MERAH: { YES: "Sudah", NO: "Tidak", UNKNOWN: "Belum tercatat" },
  ASI: { YES: "Ya", NO: "Tidak", UNKNOWN: "Belum diisi" },
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Memuat daftar">
      <Skeleton className="h-16 w-full max-w-md" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
}

function EmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Belum ada data balita</CardTitle>
        <CardDescription>
          Daftar dibuat dari data balita dan pengukuran di perangkat ini.
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

export function ListsView() {
  const today = useToday()
  const data = useReportData()
  const [selected, setSelected] = useState<MonthKey | null>(null)
  const [posyanduChoice, setPosyanduChoice] = useState(ALL_POSYANDU)

  if (today === null || data === undefined) return <LoadingSkeleton />
  if (data.children.length === 0) return <EmptyState />

  const currentMonth = monthKeyOf(today)
  const month = selected ?? currentMonth
  const names = posyanduOptions(data.children)
  const posyandu = names.includes(posyanduChoice)
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
          options={names}
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
          <ListSections
            month={month}
            data={scoped}
            posyandu={posyandu === ALL_POSYANDU ? null : posyandu}
          />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

function ListSections({
  month,
  data,
  posyandu,
}: {
  month: MonthKey
  data: ReportData
  posyandu: string | null
}) {
  const refs = use(loadWho2006References())
  const lists = useMemo(
    () => computeListsForMonth(month, data.children, data.measurements, refs),
    [month, data, refs]
  )
  const [choice, setChoice] = useState<ListChoice>("BERMASALAH")

  const statusDef =
    choice === ALL_MEASURED.id
      ? ALL_MEASURED
      : STATUS_LIST_DEFS.find((def) => def.id === choice)
  const targetDef = TARGET_LIST_DEFS.find((def) => def.id === choice)
  const statusEntries = (): ListedChild[] =>
    choice === ALL_MEASURED.id
      ? lists.status.all
      : (lists.status.lists[choice as StatusListId] ?? [])
  const count = (id: ListChoice) =>
    id === ALL_MEASURED.id
      ? lists.status.all.length
      : isTarget(id)
        ? lists.targets.lists[id].length
        : lists.status.lists[id].length

  return (
    <div className="space-y-6">
      <ValidationNotice />

      <section aria-labelledby="pick-heading" className="space-y-3">
        <h2 id="pick-heading" className="font-heading text-2xl font-semibold">
          Pilih daftar
        </h2>
        <div className="flex flex-wrap gap-2">
          {[ALL_MEASURED, ...STATUS_LIST_DEFS, ...TARGET_LIST_DEFS].map(
            (def) => (
              <Button
                key={def.id}
                variant="outline"
                aria-pressed={choice === def.id}
                onClick={() => setChoice(def.id)}
              >
                {def.title} ({count(def.id)})
              </Button>
            )
          )}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="font-heading text-xl font-semibold">
              {(statusDef ?? targetDef)?.title} · {formatMonth(month)}
            </h2>
          </CardTitle>
          <CardDescription>
            {(statusDef ?? targetDef)?.definition}
            {statusDef &&
              ` Dari ${lists.status.measured} balita yang diukur bulan ini.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {statusDef ? (
            <StatusTable entries={statusEntries()} />
          ) : targetDef ? (
            <TargetTable
              id={targetDef.id}
              entries={lists.targets.lists[targetDef.id]}
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <ExportListsButton
              month={month}
              posyandu={posyandu}
              status={lists.status}
              targets={lists.targets}
            />
            <ExportWorkbookButton
              label="Unduh format PSG dengan z-score dan status (memuat nama dan tanggal lahir)"
              fileName={`psg-${month}${posyanduSlug(posyandu)}.xlsx`}
              disabled={lists.status.all.length === 0}
              build={async () => {
                const { buildPsgWorkbook } =
                  await import("@/infrastructure/excel/psg-workbook")
                return buildPsgWorkbook(
                  month,
                  lists.status,
                  {
                    generatedOn: todayIso(),
                    scope: posyandu ?? undefined,
                    validated: ANTHROPOMETRY_VALIDATED_BY_HEALTH_PROFESSIONAL,
                  },
                  lists.recheck
                )
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="font-heading text-xl font-semibold">
              Perlu diukur ulang · {formatMonth(month)} ({lists.recheck.length})
            </h2>
          </CardTitle>
          <CardDescription>
            Anak berstatus pendek atau sangat pendek, serta ukuran yang
            dicurigai salah (tinggi atau berat turun dari pengukuran sebelumnya,
            nilai di luar rentang wajar, atau z-score yang tidak masuk akal).
            Angka tidak pernah diubah otomatis. Ukur ulang anaknya, lalu
            perbarui hanya dengan hasil ukur nyata.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RecheckTable entries={lists.recheck} />
          <ExportWorkbookButton
            label="Unduh daftar ukur ulang (memuat nama anak)"
            fileName={`ukur-ulang-${month}${posyanduSlug(posyandu)}.xlsx`}
            disabled={lists.recheck.length === 0}
            build={async () => {
              const { buildRecheckWorkbook } =
                await import("@/infrastructure/excel/recheck-workbook")
              return buildRecheckWorkbook(month, lists.recheck, {
                generatedOn: todayIso(),
                scope: posyandu ?? undefined,
              })
            }}
          />
        </CardContent>
      </Card>

      <CorrectionsImport refs={refs} />

      <ExportP1Card
        data={data}
        defaultYear={Number(month.slice(0, 4))}
        posyandu={posyandu}
      />

      <Alert>
        <AlertTitle>Cara membaca daftar ini</AlertTitle>
        <AlertDescription>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Status gizi dihitung dengan standar WHO 2006 dan Permenkes 2/2020,
              bukan tabel status gizi bawaan workbook, sehingga anggota daftar
              di dekat batas bisa berbeda tipis.
            </li>
            <li>
              Satu anak dihitung sekali per bulan, dari pengukuran terakhir
              bulan itu.
            </li>
            <li>
              Daftar memuat nama anak. Jangan dibagikan di luar petugas yang
              berkepentingan.
            </li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  )
}

function RecheckTable({ entries }: { entries: RecheckEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-base text-muted-foreground">
        Tidak ada ukuran yang ditandai pada bulan yang dipilih.
      </p>
    )
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nama</TableHead>
          <TableHead className="hidden md:table-cell">Posyandu</TableHead>
          <TableHead className="text-right">BB</TableHead>
          <TableHead className="text-right">TB</TableHead>
          <TableHead>Alasan</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.measurementId}>
            <TableCell className="whitespace-normal font-semibold">
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
            <TableCell className="text-right font-mono">
              {formatNumber(entry.weightKg)}
            </TableCell>
            <TableCell className="text-right font-mono">
              {formatNumber(entry.heightCm)}
            </TableCell>
            <TableCell className="whitespace-normal">
              <ul className="list-disc space-y-1 pl-4">
                {entry.reasons.map((reason) => (
                  <li key={reason.code}>{reason.message}</li>
                ))}
              </ul>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

const category = (
  label: keyof typeof CATEGORY_LABELS | null,
  z: number | null
) => (label === null ? "–" : `${CATEGORY_LABELS[label]} (${formatZScore(z)})`)

function StatusTable({ entries }: { entries: ListedChild[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-base text-muted-foreground">
        Tidak ada balita pada daftar ini untuk bulan yang dipilih.
      </p>
    )
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nama</TableHead>
          <TableHead className="hidden md:table-cell">Posyandu</TableHead>
          <TableHead>L/P</TableHead>
          <TableHead className="text-right">Umur</TableHead>
          <TableHead className="hidden text-right md:table-cell">BB</TableHead>
          <TableHead className="hidden text-right md:table-cell">TB</TableHead>
          <TableHead>BB/U</TableHead>
          <TableHead>TB/U</TableHead>
          <TableHead>BB/PB-TB</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.childId}>
            <TableCell className="whitespace-normal font-semibold">
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
            <TableCell>{entry.sex === "M" ? "L" : "P"}</TableCell>
            <TableCell className="text-right font-mono">
              {formatAgeMonths(entry.ageMonths)}
            </TableCell>
            <TableCell className="hidden text-right font-mono md:table-cell">
              {formatNumber(entry.weightKg)}
            </TableCell>
            <TableCell className="hidden text-right font-mono md:table-cell">
              {formatNumber(entry.heightCm)}
            </TableCell>
            <TableCell className="whitespace-normal">
              {category(entry.wazCategory, entry.waz)}
            </TableCell>
            <TableCell className="whitespace-normal">
              {category(entry.hazCategory, entry.haz)}
            </TableCell>
            <TableCell className="whitespace-normal">
              {category(entry.whzCategory, entry.whz)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function TargetTable({
  id,
  entries,
}: {
  id: TargetListId
  entries: TargetChild[]
}) {
  if (entries.length === 0) {
    return (
      <p className="text-base text-muted-foreground">
        Tidak ada anak pada rentang umur sasaran untuk bulan yang dipilih.
      </p>
    )
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nama</TableHead>
          <TableHead className="hidden md:table-cell">Posyandu</TableHead>
          <TableHead>L/P</TableHead>
          <TableHead className="text-right">Umur</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.childId}>
            <TableCell className="whitespace-normal font-semibold">
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
            <TableCell>{entry.sex === "M" ? "L" : "P"}</TableCell>
            <TableCell className="text-right font-mono">
              {formatAgeMonths(entry.ageMonths)}
            </TableCell>
            <TableCell>{TARGET_STATUS_LABELS[id][entry.status]}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
