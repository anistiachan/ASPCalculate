"use client"

import { useMemo, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CATEGORY_LABELS } from "@/domain/anthropometry/classification"
import type { ReferenceSet } from "@/domain/anthropometry/references/reference"
import {
  planCorrections,
  type CorrectionItem,
  type CorrectionPlan,
} from "@/domain/reporting/corrections"
import { computeNutritionResults } from "@/features/children/services/nutrition-results"
import { getDb } from "@/infrastructure/storage/db"
import { todayIso } from "@/lib/date/completed-months"
import { formatZScore } from "@/lib/format/format"

import { useReportData } from "../hooks/use-report-data"
import {
  applyCorrections,
  type ApplyCorrectionsResult,
} from "../services/apply-corrections"
import { readCorrectionRows } from "../services/read-corrections"

type StatusText = { before: string; after: string }

const heightStatus = (
  category: keyof typeof CATEGORY_LABELS | null,
  z: number | null
) =>
  category === null ? "–" : `${CATEGORY_LABELS[category]} (${formatZScore(z)})`

/**
 * Impor hasil ukur ulang. Berkas diisi petugas dari daftar "perlu diukur ulang". Angka baru
 * disimpan sebagai pengukuran baru pada tanggal ukur ulang; angka lama tidak ditimpa. Sebelum
 * disimpan, perubahan status ditampilkan, dan lonjakan besar wajib dikonfirmasi per baris.
 */
export function CorrectionsImport({ refs }: { refs: ReferenceSet }) {
  const data = useReportData()
  const [plan, setPlan] = useState<CorrectionPlan | null>(null)
  const [confirmed, setConfirmed] = useState<ReadonlySet<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<ApplyCorrectionsResult | null>(null)

  const statuses = useMemo(() => {
    const map = new Map<number, StatusText>()
    if (!plan || !data) return map
    const childById = new Map(data.children.map((c) => [c.id, c]))
    const measurementById = new Map(data.measurements.map((m) => [m.id, m]))
    for (const item of plan.items) {
      const child = childById.get(item.childId)
      const original = measurementById.get(item.originalMeasurementId)
      if (!child || !original) continue
      const [before] = computeNutritionResults(child, [original], refs)
      const [after] = computeNutritionResults(
        child,
        [
          {
            ...original,
            id: "pratinjau",
            measuredAt: item.next.measuredAt,
            weightKg: item.next.weightKg,
            rawLengthHeightCm: item.next.heightCm,
          },
        ],
        refs
      )
      map.set(item.rowNumber, {
        before: heightStatus(before.result.hazCategory, before.result.haz),
        after: heightStatus(after.result.hazCategory, after.result.haz),
      })
    }
    return map
  }, [plan, data, refs])

  async function handleFile(file: File) {
    setError(null)
    setOutcome(null)
    setPlan(null)
    setConfirmed(new Set())
    if (!data) return
    setBusy(true)
    try {
      const rows = readCorrectionRows(await file.arrayBuffer())
      setPlan(
        planCorrections(rows, data.children, data.measurements, todayIso())
      )
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Berkas tidak dapat dibaca. Gunakan berkas Excel hasil unduhan daftar ukur ulang."
      )
    } finally {
      setBusy(false)
    }
  }

  const needsConfirm = (item: CorrectionItem) => item.jumps.length > 0
  const toSave = plan
    ? plan.items.filter(
        (item) => !needsConfirm(item) || confirmed.has(item.rowNumber)
      )
    : []
  const waiting = plan ? plan.items.length - toSave.length : 0

  async function handleSave() {
    if (toSave.length === 0) return
    setBusy(true)
    try {
      setOutcome(await applyCorrections(getDb(), toSave))
      setPlan(null)
      setConfirmed(new Set())
    } finally {
      setBusy(false)
    }
  }

  function toggle(rowNumber: number, checked: boolean) {
    setConfirmed((previous) => {
      const next = new Set(previous)
      if (checked) next.add(rowNumber)
      else next.delete(rowNumber)
      return next
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="font-heading text-xl font-semibold">
            Impor hasil ukur ulang
          </h2>
        </CardTitle>
        <CardDescription>
          Pilih berkas daftar ukur ulang yang sudah diisi petugas (BB baru, TB
          baru, dan Tgl ukur ulang). Hasilnya disimpan sebagai pengukuran baru
          pada tanggal ukur ulang. Ukuran lama tidak dihapus dan tetap ada di
          riwayat anak.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          type="file"
          accept=".xlsx,.xls"
          disabled={busy || !data}
          aria-label="Berkas hasil ukur ulang"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ""
            if (file) void handleFile(file)
          }}
        />

        {error && (
          <p role="alert" className="text-base font-semibold text-ink-danger">
            {error}
          </p>
        )}

        {outcome && (
          <Alert role="status">
            <AlertTitle>Hasil ukur ulang disimpan</AlertTitle>
            <AlertDescription>
              {outcome.saved} pengukuran baru tersimpan.
              {outcome.failed.length > 0 && (
                <ul className="mt-2 list-disc pl-5">
                  {outcome.failed.map((f) => (
                    <li key={f.rowNumber}>
                      Baris {f.rowNumber} ({f.name}): {f.message}
                    </li>
                  ))}
                </ul>
              )}
            </AlertDescription>
          </Alert>
        )}

        {plan && (
          <div className="space-y-4">
            <p className="text-base">
              {plan.items.length} baris siap disimpan, {plan.rejected.length}{" "}
              ditolak, {plan.untouched} dibiarkan kosong.
            </p>

            {plan.items.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Tgl ukur ulang</TableHead>
                    <TableHead className="text-right">BB (kg)</TableHead>
                    <TableHead className="text-right">TB (cm)</TableHead>
                    <TableHead>TB/U semula</TableHead>
                    <TableHead>TB/U hasil ukur ulang</TableHead>
                    <TableHead>Keterangan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.items.map((item) => {
                    const status = statuses.get(item.rowNumber)
                    return (
                      <TableRow key={item.rowNumber}>
                        <TableCell className="whitespace-normal font-semibold">
                          {item.name}
                        </TableCell>
                        <TableCell>{item.next.measuredAt}</TableCell>
                        <TableCell className="whitespace-normal text-right font-mono">
                          {item.original.weightKg ?? "–"} → {item.next.weightKg}
                        </TableCell>
                        <TableCell className="whitespace-normal text-right font-mono">
                          {item.original.heightCm ?? "–"} → {item.next.heightCm}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          {status?.before ?? "–"}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          {status?.after ?? "–"}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          {item.unchanged && (
                            <p>Sama dengan ukuran semula (menguatkan).</p>
                          )}
                          {needsConfirm(item) && (
                            <div className="space-y-1">
                              {item.jumps.map((jump) => (
                                <p key={jump}>{jump}</p>
                              ))}
                              <label className="flex items-start gap-2 font-semibold">
                                <input
                                  type="checkbox"
                                  className="mt-1 size-4"
                                  checked={confirmed.has(item.rowNumber)}
                                  onChange={(event) =>
                                    toggle(item.rowNumber, event.target.checked)
                                  }
                                />
                                <span>
                                  Saya sudah memastikan ini hasil ukur ulang{" "}
                                  <span className="sr-only">
                                    untuk {item.name}
                                  </span>
                                </span>
                              </label>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}

            {plan.rejected.length > 0 && (
              <Alert>
                <AlertTitle>Baris yang ditolak</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc space-y-1 pl-5">
                    {plan.rejected.map((r) => (
                      <li key={r.rowNumber}>
                        Baris {r.rowNumber}
                        {r.name ? ` (${r.name})` : ""}: {r.message}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {waiting > 0 && (
              <p className="text-base text-muted-foreground">
                {waiting} baris menunggu konfirmasi karena angkanya berubah jauh
                dari ukuran semula.
              </p>
            )}

            <Button onClick={handleSave} disabled={busy || toSave.length === 0}>
              Simpan {toSave.length} hasil ukur ulang
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
