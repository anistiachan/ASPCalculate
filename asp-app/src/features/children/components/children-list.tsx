"use client"

import { FileUp, Plus } from "lucide-react"
import Link from "next/link"
import { useId, useMemo, useState } from "react"

import { ToggleButtonGroup } from "@/components/molecules/toggle-button-group"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatAgeMonths, formatShortDate } from "@/lib/format/format"

import { useChildSummaries } from "../hooks/use-children-data"
import { SEX_LABELS } from "../labels"
import {
  AGE_GROUP_LABELS,
  filterChildren,
  type AgeGroup,
  type SexFilter,
} from "../services/child-summaries"

const SEX_OPTIONS = [
  { value: "all", label: "Semua" },
  { value: "M", label: SEX_LABELS.M },
  { value: "F", label: SEX_LABELS.F },
] as const

const AGE_OPTIONS = (Object.keys(AGE_GROUP_LABELS) as AgeGroup[]).map(
  (value) => ({ value, label: AGE_GROUP_LABELS[value] })
)

function ListSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Memuat daftar balita">
      <Skeleton className="h-10 w-full max-w-md" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

function EmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Belum ada data balita</CardTitle>
        <CardDescription>
          Tambahkan balita satu per satu, atau impor dari file Excel Bu Bidan.
          Data disimpan di perangkat ini.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/children/new">
            <Plus aria-hidden />
            Tambah balita
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/import">
            <FileUp aria-hidden />
            Import Excel
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export function ChildrenList() {
  const searchId = useId()
  const summaries = useChildSummaries()
  const [query, setQuery] = useState("")
  const [sex, setSex] = useState<SexFilter>("all")
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("all")

  const filtered = useMemo(
    () =>
      summaries ? filterChildren(summaries, { query, sex, ageGroup }) : [],
    [summaries, query, sex, ageGroup]
  )

  if (summaries === undefined) return <ListSkeleton />
  if (summaries.length === 0) return <EmptyState />

  const isFiltering = query.trim() !== "" || sex !== "all" || ageGroup !== "all"

  function resetFilters() {
    setQuery("")
    setSex("all")
    setAgeGroup("all")
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-md space-y-1.5">
          <Label htmlFor={searchId} className="text-base font-semibold">
            Cari balita
          </Label>
          <Input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nama, atau 4 digit terakhir NIK"
            autoComplete="off"
          />
        </div>
        <Button asChild>
          <Link href="/children/new">
            <Plus aria-hidden />
            Tambah balita
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-[auto_1fr] md:items-center md:gap-x-4">
        <span className="label-caps text-muted-foreground">Jenis kelamin</span>
        <ToggleButtonGroup
          label="Filter jenis kelamin"
          options={SEX_OPTIONS}
          value={sex}
          onChange={setSex}
        />
        <span className="label-caps text-muted-foreground">Umur</span>
        <ToggleButtonGroup
          label="Filter kelompok umur"
          options={AGE_OPTIONS}
          value={ageGroup}
          onChange={setAgeGroup}
        />
      </div>

      <p role="status" className="text-base text-muted-foreground">
        Menampilkan {filtered.length} dari {summaries.length} balita
      </p>

      {filtered.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Tidak ada balita yang cocok</CardTitle>
            <CardDescription>
              Ubah kata pencarian atau filter, atau tampilkan semua balita.
            </CardDescription>
          </CardHeader>
          {isFiltering && (
            <CardContent>
              <Button variant="outline" onClick={resetFilters}>
                Hapus pencarian dan filter
              </Button>
            </CardContent>
          )}
        </Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Jenis kelamin</TableHead>
                <TableHead className="hidden md:table-cell">
                  Tanggal lahir
                </TableHead>
                <TableHead>Umur</TableHead>
                <TableHead>Terakhir diukur</TableHead>
                <TableHead className="hidden text-right lg:table-cell">
                  Jumlah ukur
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-normal">
                    <Link
                      href={`/children/${row.id}`}
                      className="text-base font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      {row.name}
                    </Link>
                    {row.nikLast4 && (
                      <span className="block text-sm text-muted-foreground">
                        NIK ••••{row.nikLast4}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{SEX_LABELS[row.sex]}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {formatShortDate(row.birthDate)}
                  </TableCell>
                  <TableCell>{formatAgeMonths(row.ageMonths)}</TableCell>
                  <TableCell>
                    {row.lastMeasuredAt
                      ? formatShortDate(row.lastMeasuredAt)
                      : "Belum pernah"}
                  </TableCell>
                  <TableCell className="hidden text-right font-mono lg:table-cell">
                    {row.measurementCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
