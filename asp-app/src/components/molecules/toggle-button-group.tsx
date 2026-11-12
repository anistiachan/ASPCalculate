"use client"

import { Button } from "@/components/ui/button"

type ToggleButtonGroupProps<T extends string> = {
  /** Nama kelompok untuk pembaca layar. */
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

/**
 * Pilihan tunggal berupa deretan tombol (mis. filter). Opsi terpilih ditandai
 * `aria-pressed` dan juga berbeda secara visual, bukan hanya warna.
 */
export function ToggleButtonGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: ToggleButtonGroupProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={selected ? "default" : "outline"}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        )
      })}
    </div>
  )
}
