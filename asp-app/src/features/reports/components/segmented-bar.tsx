"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatPercent } from "@/lib/format/format"

export type BarSegment = {
  key: string
  label: string
  count: number
  /** Warna isian (nilai CSS, mis. `var(--viz-under)`). */
  color: string
}

/**
 * Batang segmen tipis untuk satu keseluruhan yang dibaca BERSAMA angkanya (tabel di
 * sebelahnya memuat semua nilai): 8px, ujung membulat penuh, tanpa teks, jarak 2px antar
 * segmen, segmen bernilai nol tidak digambar. Tooltip hanya menambah; setiap angka juga
 * ada di tabel. Skill dataviz: Figures → segmented bar.
 */
export function SegmentedBar({
  segments,
  ariaLabel,
}: {
  segments: BarSegment[]
  ariaLabel: string
}) {
  const total = segments.reduce((sum, s) => sum + s.count, 0)
  if (total === 0) return null

  return (
    <div role="group" aria-label={ariaLabel} className="flex gap-0.5">
      {segments
        .filter((segment) => segment.count > 0)
        .map((segment) => {
          const text = `${segment.label}: ${segment.count} anak (${formatPercent(segment.count, total)})`
          return (
            <Tooltip key={segment.key}>
              <TooltipTrigger asChild>
                {/* Tombol setinggi 24px agar mudah diarahkan; batang yang tampak hanya 8px. */}
                <button
                  type="button"
                  aria-label={text}
                  className="flex h-6 min-w-2 items-center"
                  style={{ flexGrow: segment.count, flexBasis: 0 }}
                >
                  <span
                    className="block h-2 w-full rounded-full"
                    style={{ background: segment.color }}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent>{text}</TooltipContent>
            </Tooltip>
          )
        })}
    </div>
  )
}
