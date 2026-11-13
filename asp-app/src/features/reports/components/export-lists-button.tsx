"use client"

import { Download } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { ANTHROPOMETRY_VALIDATED_BY_HEALTH_PROFESSIONAL } from "@/domain/anthropometry/constants"
import type { StatusLists, TargetLists } from "@/domain/reporting/lists"
import type { MonthKey } from "@/domain/reporting/monthly-recap"
import { todayIso } from "@/lib/date/completed-months"
import { downloadBytes } from "@/lib/download"

type ExportListsButtonProps = {
  month: MonthKey
  /** Nama Posyandu bila disaring; null = semua. */
  posyandu: string | null
  status: StatusLists
  targets: TargetLists
}

/**
 * Mengunduh semua daftar bulan itu sebagai Excel. Berkas memuat NAMA anak, jadi tombolnya
 * menyebutkannya dan berkas tidak pernah dikirim ke mana pun (dibuat di browser).
 */
export function ExportListsButton({
  month,
  posyandu,
  status,
  targets,
}: ExportListsButtonProps) {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function handleClick() {
    setPending(true)
    setFailed(false)
    try {
      const { buildListsWorkbook } =
        await import("@/infrastructure/excel/lists-workbook")
      const { XLSX_MIME_TYPE } =
        await import("@/infrastructure/excel/recap-workbook")
      const bytes = buildListsWorkbook(month, status, targets, {
        generatedOn: todayIso(),
        scope: posyandu ?? undefined,
        validated: ANTHROPOMETRY_VALIDATED_BY_HEALTH_PROFESSIONAL,
      })
      const suffix = posyandu
        ? `-${posyandu
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")}`
        : ""
      downloadBytes(`daftar-${month}${suffix}.xlsx`, bytes, XLSX_MIME_TYPE)
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-1">
      <Button variant="outline" onClick={handleClick} disabled={pending}>
        <Download aria-hidden />
        {pending ? "Menyiapkan…" : "Unduh Excel (memuat nama anak)"}
      </Button>
      {failed && (
        <p role="alert" className="text-sm font-semibold text-ink-danger">
          Gagal membuat file Excel. Coba lagi.
        </p>
      )}
    </div>
  )
}
