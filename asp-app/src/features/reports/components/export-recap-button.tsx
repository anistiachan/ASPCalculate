"use client"

import { Download } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  ALGORITHM_VERSION,
  ANTHROPOMETRY_VALIDATED_BY_HEALTH_PROFESSIONAL,
} from "@/domain/anthropometry/constants"
import type { MonthlyRecap } from "@/domain/reporting/monthly-recap"
import type { SkdnMonthly } from "@/domain/reporting/skdn"
import { todayIso } from "@/lib/date/completed-months"
import { downloadBytes } from "@/lib/download"

type ExportRecapButtonProps = {
  recap: MonthlyRecap
  skdn: SkdnMonthly
  /** Nama Posyandu bila laporan disaring; null = semua Posyandu. */
  posyandu: string | null
  referenceVersion: string
}

/**
 * Mengunduh rekap sebagai Excel. Berkas dibuat di browser (SheetJS dimuat saat dibutuhkan)
 * dan hanya memuat angka agregat tanpa data pribadi anak.
 */
export function ExportRecapButton({
  recap,
  skdn,
  posyandu,
  referenceVersion,
}: ExportRecapButtonProps) {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function handleClick() {
    setPending(true)
    setFailed(false)
    try {
      const { buildRecapWorkbook, XLSX_MIME_TYPE } =
        await import("@/infrastructure/excel/recap-workbook")
      const bytes = buildRecapWorkbook(
        recap,
        {
          generatedOn: todayIso(),
          algorithmVersion: ALGORITHM_VERSION,
          referenceVersion,
          validated: ANTHROPOMETRY_VALIDATED_BY_HEALTH_PROFESSIONAL,
          scope: posyandu ?? undefined,
        },
        skdn
      )
      const suffix = posyandu
        ? `-${posyandu
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")}`
        : ""
      downloadBytes(`rekap-${recap.month}${suffix}.xlsx`, bytes, XLSX_MIME_TYPE)
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-1">
      <Button onClick={handleClick} disabled={pending}>
        <Download aria-hidden />
        {pending ? "Menyiapkan…" : "Unduh Excel"}
      </Button>
      {failed && (
        <p role="alert" className="text-sm font-semibold text-ink-danger">
          Gagal membuat file Excel. Coba lagi.
        </p>
      )}
    </div>
  )
}
