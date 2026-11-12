"use client"

import { Trash2 } from "lucide-react"
import { useState } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

type ConfirmDeleteDialogProps = {
  /** Teks tombol pemicu, mis. "Hapus". */
  triggerLabel: string
  /** Nama aksesibel yang menyebut objeknya, mis. "Hapus pengukuran 5 Juni 2026". */
  triggerAriaLabel?: string
  title: string
  description: string
  /** Dijalankan saat pengguna mengonfirmasi. Dialog tetap terbuka bila melempar error. */
  onConfirm: () => Promise<void>
}

/**
 * Konfirmasi sebelum menghapus. Tindakan hapus tidak bisa dibatalkan, jadi dialog
 * menjelaskan akibatnya dan tombol batal menjadi fokus awal.
 */
export function ConfirmDeleteDialog({
  triggerLabel,
  triggerAriaLabel,
  title,
  description,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setPending(true)
    setError(null)
    try {
      await onConfirm()
      setOpen(false)
    } catch {
      // Tidak menampilkan detail error: bisa memuat data pribadi.
      setError("Gagal menghapus. Tidak ada data yang berubah; coba lagi.")
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        setOpen(next)
        if (!next) setError(null)
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" aria-label={triggerAriaLabel}>
          <Trash2 aria-hidden />
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm font-semibold text-ink-danger">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(event) => {
              // Cegah dialog menutup sebelum penghapusan selesai.
              event.preventDefault()
              void handleConfirm()
            }}
          >
            {pending ? "Menghapus…" : "Ya, hapus"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
