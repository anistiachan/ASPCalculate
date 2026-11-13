"use client"

import { useState } from "react"

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
import { useReportData } from "@/features/reports/hooks/use-report-data"
import { todayIso } from "@/lib/date/completed-months"
import { downloadBytes } from "@/lib/download"
import type { RestorePlan } from "@/infrastructure/storage/backup"

type RestoreState =
  | { step: "idle" }
  | { step: "reading" }
  | { step: "error"; message: string }
  | {
      step: "preview"
      plan: RestorePlan
      invalidRecords: number
      fileName: string
    }
  | { step: "saving" }
  | { step: "done"; childrenNew: number; measurementsNew: number }

/**
 * Cadangkan dan pulihkan seluruh data. Data hidup di browser perangkat ini, jadi cadangan adalah
 * satu-satunya cara memindahkannya atau mengamankannya dari hapus data situs. Berkas dibuat dan
 * dibaca di perangkat, tidak dikirim ke server. Pemulihan hanya menambah, tidak menimpa.
 */
export function BackupRestore() {
  const data = useReportData()
  const [failed, setFailed] = useState(false)
  const [restore, setRestore] = useState<RestoreState>({ step: "idle" })

  async function handleBackup() {
    setFailed(false)
    try {
      const { getDb } = await import("@/infrastructure/storage/db")
      const { exportBackup, serializeBackup } =
        await import("@/infrastructure/storage/backup")
      const bytes = serializeBackup(await exportBackup(getDb()))
      downloadBytes(
        `openasp-cadangan-${todayIso()}.json`,
        bytes,
        "application/json"
      )
    } catch {
      setFailed(true)
    }
  }

  async function handleFile(file: File) {
    setRestore({ step: "reading" })
    try {
      const { getDb } = await import("@/infrastructure/storage/db")
      const { previewRestore } = await import("@/infrastructure/storage/backup")
      const result = await previewRestore(getDb(), await file.text())
      setRestore(
        result.ok
          ? {
              step: "preview",
              plan: result.plan,
              invalidRecords: result.invalidRecords,
              fileName: file.name,
            }
          : { step: "error", message: result.message }
      )
    } catch {
      setRestore({
        step: "error",
        message: "Berkas tidak dapat dibaca. Coba pilih berkas cadangan lain.",
      })
    }
  }

  async function handleApply(plan: RestorePlan) {
    setRestore({ step: "saving" })
    try {
      const { getDb } = await import("@/infrastructure/storage/db")
      const { applyRestore } = await import("@/infrastructure/storage/backup")
      await applyRestore(getDb(), plan)
      setRestore({
        step: "done",
        childrenNew: plan.summary.childrenNew,
        measurementsNew: plan.summary.measurementsNew,
      })
    } catch {
      // Transaksi dibatalkan seluruhnya, jadi tidak ada data setengah masuk.
      setRestore({
        step: "error",
        message:
          "Gagal menyimpan. Tidak ada data yang berubah; coba lagi atau gunakan browser lain.",
      })
    }
  }

  const busy = restore.step === "reading" || restore.step === "saving"
  const empty = data !== undefined && data.children.length === 0

  return (
    <div className="space-y-6">
      <Alert>
        <AlertTitle>Data hanya ada di browser ini</AlertTitle>
        <AlertDescription>
          Data tersimpan di penyimpanan browser perangkat ini dan bisa hilang
          bila data situs dihapus. Unduh cadangan secara berkala, terutama
          sebelum membersihkan browser atau berganti perangkat.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="font-heading text-xl font-semibold">
              Cadangkan data
            </h2>
          </CardTitle>
          <CardDescription>
            {data === undefined
              ? "Memuat…"
              : `Berisi ${data.children.length} anak dan ${data.measurements.length} pengukuran.`}{" "}
            Berkas cadangan memuat nama dan tanggal lahir semua anak dan tidak
            dienkripsi. Simpan di tempat yang aman dan jangan dibagikan di luar
            petugas yang berkepentingan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" onClick={handleBackup} disabled={empty}>
            Unduh cadangan data (memuat nama dan tanggal lahir)
          </Button>
          {empty && (
            <p className="text-sm text-muted-foreground">
              Belum ada data untuk dicadangkan.
            </p>
          )}
          {failed && (
            <p role="alert" className="text-sm font-semibold text-ink-danger">
              Gagal membuat cadangan. Coba lagi.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="font-heading text-xl font-semibold">
              Pulihkan data
            </h2>
          </CardTitle>
          <CardDescription>
            Pilih berkas cadangan (.json). Pemulihan hanya menambahkan data yang
            belum ada. Data yang sudah ada tidak ditimpa atau dihapus, dan
            hasilnya diperiksa dulu sebelum disimpan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            accept=".json,application/json"
            disabled={busy}
            aria-label="Berkas cadangan"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) void handleFile(file)
            }}
          />

          {restore.step === "reading" && (
            <p role="status" className="text-sm text-muted-foreground">
              Membaca berkas…
            </p>
          )}

          {restore.step === "error" && (
            <p role="alert" className="text-base font-semibold text-ink-danger">
              {restore.message}
            </p>
          )}

          {restore.step === "done" && (
            <Alert role="status">
              <AlertTitle>Pemulihan selesai</AlertTitle>
              <AlertDescription>
                {restore.childrenNew} anak dan {restore.measurementsNew}{" "}
                pengukuran ditambahkan.
              </AlertDescription>
            </Alert>
          )}

          {restore.step === "preview" && (
            <Preview
              state={restore}
              onApply={() => void handleApply(restore.plan)}
              onCancel={() => setRestore({ step: "idle" })}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Preview({
  state,
  onApply,
  onCancel,
}: {
  state: Extract<RestoreState, { step: "preview" }>
  onApply: () => void
  onCancel: () => void
}) {
  const { summary } = state.plan
  const skipped: string[] = []
  if (summary.childrenExisting > 0) {
    skipped.push(`${summary.childrenExisting} anak sudah ada`)
  }
  if (summary.childrenConflict > 0) {
    skipped.push(
      `${summary.childrenConflict} anak dilewati karena NIK atau kunci impornya sudah dipakai anak lain`
    )
  }
  if (summary.measurementsExisting > 0) {
    skipped.push(`${summary.measurementsExisting} pengukuran sudah ada`)
  }
  if (summary.measurementsOrphan > 0) {
    skipped.push(
      `${summary.measurementsOrphan} pengukuran dilewati karena anaknya tidak ikut dipulihkan`
    )
  }
  if (state.invalidRecords > 0) {
    skipped.push(`${state.invalidRecords} catatan rusak diabaikan`)
  }
  const nothing = summary.childrenNew === 0 && summary.measurementsNew === 0

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Pratinjau: {state.fileName}</h3>
      <p className="text-base">
        Akan ditambahkan: <strong>{summary.childrenNew} anak</strong> dan{" "}
        <strong>{summary.measurementsNew} pengukuran</strong>.
      </p>
      {skipped.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-base text-muted-foreground">
          {skipped.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {nothing && (
        <p className="text-base">
          Tidak ada data baru untuk dipulihkan dari berkas ini.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onApply} disabled={nothing}>
          Pulihkan {summary.childrenNew} anak dan {summary.measurementsNew}{" "}
          pengukuran
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Batal
        </Button>
      </div>
    </div>
  )
}
