"use client"

import { Download } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { downloadBytes } from "@/lib/download"

type ExportWorkbookButtonProps = {
  label: string
  fileName: string
  /** Membuat isi berkas di browser; tidak pernah dikirim ke mana pun. */
  build: () => Promise<Uint8Array>
  disabled?: boolean
}

/** Tombol unduh Excel umum: membuat berkas di perangkat, lalu mengunduhnya. */
export function ExportWorkbookButton({
  label,
  fileName,
  build,
  disabled = false,
}: ExportWorkbookButtonProps) {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function handleClick() {
    setPending(true)
    setFailed(false)
    try {
      const bytes = await build()
      const { XLSX_MIME_TYPE } =
        await import("@/infrastructure/excel/recap-workbook")
      downloadBytes(fileName, bytes, XLSX_MIME_TYPE)
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        onClick={handleClick}
        disabled={pending || disabled}
      >
        <Download aria-hidden />
        {pending ? "Menyiapkan…" : label}
      </Button>
      {failed && (
        <p role="alert" className="text-sm font-semibold text-ink-danger">
          Gagal membuat file Excel. Coba lagi.
        </p>
      )}
    </div>
  )
}
