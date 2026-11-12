import { useId, type ReactNode } from "react"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type FormFieldProps = {
  label: string
  /** Menandai wajib diisi secara visual dan untuk pembaca layar. */
  required?: boolean
  hint?: string
  error?: string
  className?: string
  /** Fungsi agar input menerima atribut aksesibilitas yang sudah tersusun. */
  children: (props: {
    id: string
    "aria-invalid": boolean
    "aria-describedby": string | undefined
    "aria-required": boolean | undefined
  }) => ReactNode
}

/**
 * Label + kontrol + petunjuk + pesan error. Pesan error dibacakan pembaca layar
 * (`role="alert"`) dan dihubungkan ke input lewat `aria-describedby`.
 *
 * `id` dibuat dengan `useId()`, bukan diberikan pemanggil: Next.js (Cache Components)
 * menyimpan halaman sebelumnya yang tersembunyi di DOM, sehingga `id` statis bisa
 * bentrok antar halaman dan membuat label menunjuk ke kolom yang salah.
 */
export function FormField({
  label,
  required,
  hint,
  error,
  className,
  children,
}: FormFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-base font-semibold">
        {label}
        {required && (
          <>
            <span aria-hidden className="text-ink-danger">
              {" "}
              *
            </span>
            <span className="sr-only"> (wajib diisi)</span>
          </>
        )}
      </Label>
      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": describedBy,
        "aria-required": required ? true : undefined,
      })}
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-sm font-semibold text-ink-danger"
        >
          {error}
        </p>
      )}
    </div>
  )
}
