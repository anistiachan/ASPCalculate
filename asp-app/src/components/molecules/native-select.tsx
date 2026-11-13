import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

/**
 * Pilihan dropdown bawaan browser dengan gaya yang sama seperti Input. Select bawaan
 * dipakai (bukan komponen kustom) agar bekerja baik di HP, keyboard, dan pembaca layar
 * tanpa kode tambahan. Beri label lewat FormField atau <Label htmlFor>.
 */
export function NativeSelect({
  className,
  ...props
}: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 rounded-lg border border-input bg-card px-3 text-base transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}
