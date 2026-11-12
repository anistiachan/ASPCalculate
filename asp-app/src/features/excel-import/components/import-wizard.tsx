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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { TONE_CLASSES, type Tone } from "@/lib/constants/tones"

import { analyzeFile, ImportAnalysisError } from "../services/analyze-file"
import { commitImport } from "../services/commit-import"
import type { ImportPlan } from "../services/plan-import"
import type { ValidatedBatch } from "../validators/validate-batch"
import { ImportIssueList } from "./import-issue-list"

type WizardState =
  | { step: "idle" }
  | { step: "reading"; fileName: string }
  | { step: "error"; message: string }
  | { step: "preview"; validated: ValidatedBatch }
  | { step: "saving"; validated: ValidatedBatch }
  | { step: "done"; plan: ImportPlan; fileName: string }

/**
 * Kartu angka. Warna hanya mempertegas; makna dibawa label teks, sehingga tetap
 * terbaca tanpa warna.
 */
function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: number
  tone?: Tone
}) {
  return (
    <Card size="sm" className={TONE_CLASSES[tone].panel}>
      <CardHeader>
        <CardDescription className="label-caps text-current">
          {label}
        </CardDescription>
        {/* Varian group-data-[size=sm] diperlukan: CardTitle punya aturan ukuran sendiri untuk kartu kecil. */}
        <CardTitle className="font-heading text-3xl font-semibold tabular-nums group-data-[size=sm]/card:text-3xl">
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}

export function ImportWizard() {
  const [state, setState] = useState<WizardState>({ step: "idle" })

  async function handleFile(file: File) {
    setState({ step: "reading", fileName: file.name })
    try {
      setState({ step: "preview", validated: await analyzeFile(file) })
    } catch (error) {
      setState({
        step: "error",
        message:
          error instanceof ImportAnalysisError
            ? error.message
            : "File tidak dapat diproses.",
      })
    }
  }

  async function handleConfirm(validated: ValidatedBatch) {
    setState({ step: "saving", validated })
    try {
      const { getDb } = await import("@/infrastructure/storage/db")
      const plan = await commitImport(getDb(), validated)
      setState({ step: "done", plan, fileName: validated.fileName })
    } catch {
      // Pesan error database bisa memuat nilai kunci (NIK), jadi tidak ditampilkan.
      setState({
        step: "error",
        message:
          "Gagal menyimpan data. Tidak ada data yang tersimpan; coba lagi atau gunakan browser lain.",
      })
    }
  }

  const reset = () => setState({ step: "idle" })
  const busy = state.step === "reading" || state.step === "saving"

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Alert>
        <AlertTitle>Data diproses di perangkat ini</AlertTitle>
        <AlertDescription>
          File Excel dibaca langsung di browser dan tidak diunggah ke server.
          Data yang disimpan berada di penyimpanan browser perangkat ini dan
          dapat hilang jika data situs dihapus.
        </AlertDescription>
      </Alert>

      {(state.step === "idle" ||
        state.step === "reading" ||
        state.step === "error") && (
        <Card>
          <CardHeader>
            <CardTitle>Pilih file Excel</CardTitle>
            <CardDescription>
              Format Ukur Master Bu Bidan (.xlsx atau .xls). Maksimal 20 MB.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="file"
              accept=".xlsx,.xls"
              disabled={busy}
              aria-label="File Excel"
              onChange={(event) => {
                const file = event.target.files?.[0]
                // Kosongkan agar memilih file yang sama lagi tetap memicu perubahan.
                event.target.value = ""
                if (file) void handleFile(file)
              }}
            />
            {state.step === "reading" && (
              <p className="text-sm text-muted-foreground" role="status">
                Membaca {state.fileName}…
              </p>
            )}
            {state.step === "error" && (
              <Alert variant="destructive">
                <AlertTitle>Import gagal</AlertTitle>
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {(state.step === "preview" || state.step === "saving") && (
        <Preview
          validated={state.validated}
          saving={state.step === "saving"}
          onConfirm={() => void handleConfirm(state.validated)}
          onCancel={reset}
        />
      )}

      {state.step === "done" && (
        <Done plan={state.plan} fileName={state.fileName} onReset={reset} />
      )}
    </div>
  )
}

function Preview({
  validated,
  saving,
  onConfirm,
  onCancel,
}: {
  validated: ValidatedBatch
  saving: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const { children, measurements, counts, sheetSummaries, skippedSheets } =
    validated
  const nothingToSave = children.length === 0 && measurements.length === 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          Pratinjau: {validated.fileName}
        </h2>
        <p className="text-sm text-muted-foreground">
          Periksa hasil di bawah sebelum menyimpan. Belum ada data yang
          tersimpan.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Anak siap disimpan" value={children.length} tone="green" />
        <Stat
          label="Pengukuran siap disimpan"
          value={measurements.length}
          tone="sky"
        />
        <Stat
          label="Error"
          value={counts.errors}
          tone={counts.errors > 0 ? "danger" : "neutral"}
        />
        <Stat
          label="Peringatan"
          value={counts.warnings}
          tone={counts.warnings > 0 ? "butter" : "neutral"}
        />
      </div>

      {counts.errors > 0 && (
        <Alert variant="destructive">
          <AlertTitle>Ada baris yang tidak bisa diimpor</AlertTitle>
          <AlertDescription>
            Baris dengan error tidak akan disimpan. Baris yang valid tetap
            disimpan. Perbaiki file sumbernya lalu impor ulang untuk menambahkan
            baris yang ditolak; data yang sudah tersimpan tidak akan digandakan.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ringkasan per sheet</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sheet</TableHead>
                <TableHead className="text-right">Baris terbaca</TableHead>
                <TableHead className="text-right">Diimpor</TableHead>
                <TableHead className="text-right">Belum diukur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sheetSummaries.map((summary) => (
                <TableRow key={summary.sheet}>
                  <TableCell>{summary.sheet}</TableCell>
                  <TableCell className="text-right font-mono">
                    {summary.rowsRead}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {summary.rowsImported}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {summary.kind === "measurements"
                      ? summary.rowsWithoutMeasurement
                      : "–"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {skippedSheets.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {skippedSheets.map((sheet) => (
                <li key={sheet.name}>
                  Sheet &quot;{sheet.name}&quot; dilewati: {sheet.reason}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {validated.issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Catatan</CardTitle>
            <CardDescription>
              Error ditampilkan lebih dulu. Lokasi ditunjukkan dengan sheet dan
              nomor baris di file Excel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImportIssueList issues={validated.issues} />
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={onConfirm} disabled={saving || nothingToSave}>
          {saving
            ? "Menyimpan…"
            : `Simpan ${children.length} anak dan ${measurements.length} pengukuran`}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Batal
        </Button>
      </div>
    </div>
  )
}

function Done({
  plan,
  fileName,
  onReset,
}: {
  plan: ImportPlan
  fileName: string
  onReset: () => void
}) {
  const { summary } = plan
  const conflicts =
    summary.childrenConflict +
    summary.measurementsConflict +
    summary.measurementsSkippedChildConflict

  return (
    <div className="space-y-6">
      <Alert>
        <AlertTitle>Import selesai</AlertTitle>
        <AlertDescription>
          {fileName}: {summary.childrenNew} anak dan {summary.measurementsNew}{" "}
          pengukuran baru disimpan.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Anak baru" value={summary.childrenNew} tone="green" />
        <Stat label="Anak sudah ada" value={summary.childrenUnchanged} />
        <Stat
          label="Pengukuran baru"
          value={summary.measurementsNew}
          tone="sky"
        />
        <Stat
          label="Pengukuran sudah ada"
          value={summary.measurementsDuplicate}
        />
      </div>

      {conflicts > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Konflik dengan data tersimpan</CardTitle>
            <CardDescription>
              Baris berikut dilewati dan data lama dipertahankan. Tidak ada data
              yang ditimpa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImportIssueList issues={plan.issues} />
          </CardContent>
        </Card>
      )}

      <Button variant="outline" onClick={onReset}>
        Impor file lain
      </Button>
    </div>
  )
}
