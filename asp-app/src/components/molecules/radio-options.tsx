import type { UseFormRegisterReturn } from "react-hook-form"

import { cn } from "@/lib/utils"

type RadioOptionsProps = {
  /** Hasil `register("nama")` dari React Hook Form. */
  registration: UseFormRegisterReturn
  options: readonly { value: string; label: string }[]
  invalid?: boolean
  describedBy?: string
}

/**
 * Pilihan tunggal berupa radio bawaan browser yang diberi gaya tombol. Radio asli
 * dipakai agar navigasi keyboard (panah) dan pembaca layar bekerja tanpa kode tambahan.
 */
export function RadioOptions({
  registration,
  options,
  invalid,
  describedBy,
}: RadioOptionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 text-base",
            "has-[:checked]:border-primary has-[:checked]:bg-tint-green has-[:checked]:font-semibold has-[:checked]:text-ink-green",
            invalid ? "border-destructive" : "border-input"
          )}
        >
          <input
            type="radio"
            value={option.value}
            aria-describedby={describedBy}
            className="size-4 accent-primary"
            {...registration}
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}
