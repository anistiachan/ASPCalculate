"use client"

import { Pencil, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { BackLink } from "@/components/molecules/back-link"
import { PageHeader } from "@/components/molecules/page-header"
import { Badge } from "@/components/ui/badge"
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
import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"
import { getDb } from "@/infrastructure/storage/db"
import {
  deleteChild,
  deleteMeasurement,
} from "@/infrastructure/storage/repositories/child-repository"
import { getNavItem } from "@/lib/constants/navigation"
import { completedMonths, todayIso } from "@/lib/date/completed-months"
import {
  formatAgeMonths,
  formatDate,
  formatNumber,
  formatShortDate,
} from "@/lib/format/format"

import { useChild, useChildMeasurements } from "../hooks/use-children-data"
import { POSITION_LABELS, SEX_LABELS } from "../labels"
import { ConfirmDeleteDialog } from "./confirm-delete-dialog"
import { NotFoundCard } from "./not-found-card"

export function ChildDetail({ childId }: { childId: string }) {
  const child = useChild(childId)
  const measurements = useChildMeasurements(childId)

  if (child === undefined || measurements === undefined) {
    return (
      <div className="space-y-4" role="status" aria-label="Memuat data balita">
        <Skeleton className="h-16 w-full max-w-md" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (child === null) {
    return (
      <NotFoundCard
        title="Balita tidak ditemukan"
        description="Data ini tidak ada di perangkat ini. Mungkin sudah dihapus."
      />
    )
  }

  return <ChildDetailView child={child} measurements={measurements} />
}

function ProfileItem({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-0.5">
      <dt className="label-caps text-muted-foreground">{label}</dt>
      <dd className="text-base">{children}</dd>
    </div>
  )
}

function ChildDetailView({
  child,
  measurements,
}: {
  child: StoredChild
  measurements: StoredMeasurement[]
}) {
  const router = useRouter()
  const ageMonths = completedMonths(child.birthDate, todayIso())

  async function handleDeleteChild() {
    await deleteChild(getDb(), child.id)
    router.push("/children")
  }

  return (
    <div className="space-y-6">
      <BackLink href="/children">Daftar balita</BackLink>

      <PageHeader
        item={getNavItem("/children")}
        title={child.name}
        description={`${SEX_LABELS[child.sex]} · ${formatAgeMonths(ageMonths)}`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Data balita</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="grid gap-4 sm:grid-cols-2">
            <ProfileItem label="Tanggal lahir">
              {formatDate(child.birthDate)}
            </ProfileItem>
            <ProfileItem label="Jenis kelamin">
              {SEX_LABELS[child.sex]}
            </ProfileItem>
            <ProfileItem label="Umur sekarang">
              {formatAgeMonths(ageMonths)}
            </ProfileItem>
            <ProfileItem label="NIK">
              {child.sourceKey ? (
                <span className="font-mono">
                  ••••••••••••{child.sourceKey.slice(-4)}
                </span>
              ) : (
                "Tidak diisi"
              )}
            </ProfileItem>
            <ProfileItem label="Asal data">
              {child.importBatchId ? "Import Excel" : "Dicatat manual"}
            </ProfileItem>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/children/${child.id}/edit`}>
                <Pencil aria-hidden />
                Ubah data
              </Link>
            </Button>
            <ConfirmDeleteDialog
              triggerLabel="Hapus balita"
              title="Hapus balita ini?"
              description={`Data ${child.name} dan ${measurements.length} pengukurannya akan dihapus dari perangkat ini. Tindakan ini tidak bisa dibatalkan.`}
              onConfirm={handleDeleteChild}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Riwayat pengukuran</CardTitle>
              <CardDescription>
                Nilai panjang/tinggi ditampilkan apa adanya sesuai hasil ukur.
              </CardDescription>
            </div>
            <Button asChild>
              <Link href={`/children/${child.id}/measurements/new`}>
                <Plus aria-hidden />
                Tambah pengukuran
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {measurements.length === 0 ? (
            <p className="px-4 text-base text-muted-foreground">
              Belum ada pengukuran untuk balita ini.
            </p>
          ) : (
            <MeasurementHistory child={child} measurements={measurements} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MeasurementHistory({
  child,
  measurements,
}: {
  child: StoredChild
  measurements: StoredMeasurement[]
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tanggal ukur</TableHead>
          <TableHead>Umur</TableHead>
          <TableHead className="text-right">Berat (kg)</TableHead>
          <TableHead className="text-right">PB/TB (cm)</TableHead>
          <TableHead className="hidden md:table-cell">Cara ukur</TableHead>
          <TableHead className="hidden text-right lg:table-cell">
            LILA (cm)
          </TableHead>
          <TableHead className="hidden text-right lg:table-cell">
            L. kepala (cm)
          </TableHead>
          <TableHead className="hidden md:table-cell">Sumber</TableHead>
          <TableHead>
            <span className="sr-only">Tindakan</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {measurements.map((m) => (
          <MeasurementRow key={m.id} child={child} measurement={m} />
        ))}
      </TableBody>
    </Table>
  )
}

function MeasurementRow({
  child,
  measurement: m,
}: {
  child: StoredChild
  measurement: StoredMeasurement
}) {
  const dateText = formatShortDate(m.measuredAt)

  return (
    <TableRow>
      <TableCell className="whitespace-normal">
        <span className="font-semibold">{dateText}</span>
        {m.rowNote && (
          <span className="block text-sm text-muted-foreground">
            {m.rowNote}
          </span>
        )}
      </TableCell>
      <TableCell>
        {formatAgeMonths(completedMonths(child.birthDate, m.measuredAt))}
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatNumber(m.weightKg)}
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatNumber(m.rawLengthHeightCm)}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {m.rawLengthHeightCm === null
          ? "–"
          : POSITION_LABELS[m.measurementPosition]}
      </TableCell>
      <TableCell className="hidden text-right font-mono lg:table-cell">
        {formatNumber(m.lilaCm)}
      </TableCell>
      <TableCell className="hidden text-right font-mono lg:table-cell">
        {formatNumber(m.headCircumferenceCm)}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Badge variant={m.importBatchId ? "secondary" : "info"}>
          {m.importBatchId ? "Import" : "Manual"}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-2">
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/children/${child.id}/measurements/${m.id}/edit`}
              aria-label={`Ubah pengukuran ${dateText}`}
            >
              <Pencil aria-hidden />
              Ubah
            </Link>
          </Button>
          <ConfirmDeleteDialog
            triggerLabel="Hapus"
            triggerAriaLabel={`Hapus pengukuran ${dateText}`}
            title="Hapus pengukuran ini?"
            description={`Pengukuran tanggal ${formatDate(m.measuredAt)} akan dihapus dari perangkat ini. Tindakan ini tidak bisa dibatalkan.`}
            onConfirm={() => deleteMeasurement(getDb(), m.id)}
          />
        </div>
      </TableCell>
    </TableRow>
  )
}
