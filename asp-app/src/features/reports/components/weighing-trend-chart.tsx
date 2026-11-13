"use client"

import { useEffect, useRef, useState } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { MonthlyCoverage } from "@/domain/reporting/monthly-recap"
import {
  formatMonth,
  formatMonthShort,
  formatPercent,
} from "@/lib/format/format"

import { niceScale } from "../chart-scale"

/*
 * Grafik kolom satu seri: balita ditimbang per bulan.
 *
 * Mengikuti skill dataviz: kolom <= 24px dengan ujung atas membulat 4px dan dasar rata,
 * garis bantu hairline solid yang redup, tanpa kotak legenda (satu seri: judul sudah
 * menyebutnya), nilai hanya pada kolom terakhir, teks memakai token teks (bukan warna
 * data), tooltip untuk hover DAN fokus keyboard, area sorot lebih lebar dari kolom, serta
 * tabel pendamping untuk setiap nilai. Tidak ada animasi.
 */

// Lebar minimum grafik; di wadah yang lebih lebar, grafik dirender selebar wadah (1 unit = 1 px)
// agar teks tidak ikut membesar.
const MIN_WIDTH = 640
const HEIGHT = 248
const MARGIN = { top: 24, right: 12, bottom: 48, left: 44 }
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom
const MAX_BAR_WIDTH = 24
const BAR_RADIUS = 4

/** Kolom dengan ujung atas membulat dan dasar rata (menempel pada garis dasar). */
function columnPath(
  x: number,
  y: number,
  width: number,
  height: number
): string {
  const r = Math.min(BAR_RADIUS, width / 2, height)
  return [
    `M ${x} ${y + height}`,
    `V ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `H ${x + width - r}`,
    `Q ${x + width} ${y} ${x + width} ${y + r}`,
    `V ${y + height}`,
    "Z",
  ].join(" ")
}

export function WeighingTrendChart({ points }: { points: MonthlyCoverage[] }) {
  const [active, setActive] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Grafik tren dibaca dari yang terbaru. Di layar sempit grafik lebih lebar daripada
  // wadahnya, jadi dibuka di ujung kanan (bulan terbaru), bukan di bulan tertua.
  useEffect(() => {
    const scroller = scrollRef.current
    if (scroller) scroller.scrollLeft = scroller.scrollWidth
  }, [])

  const [containerWidth, setContainerWidth] = useState(MIN_WIDTH)
  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    const observer = new ResizeObserver(([entry]) =>
      setContainerWidth(Math.floor(entry.contentRect.width))
    )
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [])
  const WIDTH = Math.max(MIN_WIDTH, containerWidth)
  const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right

  const maxValue = Math.max(0, ...points.map((p) => p.weighed.ALL))
  const { step, intervals, yMax } = niceScale(maxValue)
  const slot = PLOT_WIDTH / points.length
  const barWidth = Math.min(MAX_BAR_WIDTH, slot * 0.6)
  const yOf = (value: number) => MARGIN.top + PLOT_HEIGHT * (1 - value / yMax)
  const baseline = yOf(0)
  const last = points.length - 1

  const activePoint = active === null ? null : points[active]
  // Tooltip diletakkan di SAMPING kolom yang disorot (kanan untuk separuh kiri grafik, kiri
  // untuk separuh kanan) dan di bagian atas area plot. Di atas kolom ia akan terpotong
  // kontainer yang bisa digulir; di samping ia tidak menutupi kolomnya dan tidak pernah
  // keluar dari tepi.
  const tooltipOnRight = active !== null && active < points.length / 2

  return (
    <figure className="@container space-y-3">
      <div ref={scrollRef} className="overflow-x-auto">
        <div className="relative" style={{ width: WIDTH }}>
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            width={WIDTH}
            height={HEIGHT}
            role="group"
            aria-label="Grafik kolom: jumlah balita ditimbang per bulan"
          >
            {/* Garis bantu hairline solid; garis dasar sedikit lebih tegas. */}
            {Array.from({ length: intervals + 1 }, (_, i) => {
              const value = i * step
              const y = yOf(value)
              return (
                <g key={value}>
                  <line
                    x1={MARGIN.left}
                    x2={WIDTH - MARGIN.right}
                    y1={y}
                    y2={y}
                    strokeWidth={1}
                    style={{
                      stroke: i === 0 ? "var(--viz-axis)" : "var(--viz-grid)",
                    }}
                  />
                  <text
                    x={MARGIN.left - 8}
                    y={y}
                    dy="0.32em"
                    textAnchor="end"
                    fontSize={14}
                    className="fill-muted-foreground"
                  >
                    {value}
                  </text>
                </g>
              )
            })}

            {points.map((point, index) => {
              const slotX = MARGIN.left + index * slot
              const value = point.weighed.ALL
              const height = (PLOT_HEIGHT * value) / yMax
              const x = slotX + (slot - barWidth) / 2
              const showYear = index === 0 || point.month.endsWith("-01")
              const isActive = active === index

              return (
                <g key={point.month}>
                  {isActive && (
                    <rect
                      x={slotX}
                      y={MARGIN.top}
                      width={slot}
                      height={PLOT_HEIGHT}
                      className="fill-muted"
                    />
                  )}
                  {value > 0 && (
                    <path
                      d={columnPath(x, baseline - height, barWidth, height)}
                      style={{
                        fill: isActive
                          ? "var(--primary-hover)"
                          : "var(--viz-bar)",
                      }}
                    />
                  )}
                  {index === last && (
                    <text
                      x={slotX + slot / 2}
                      y={baseline - height - 6}
                      textAnchor="middle"
                      fontSize={14}
                      fontWeight={600}
                      className="fill-foreground"
                    >
                      {value}
                    </text>
                  )}
                  <text
                    x={slotX + slot / 2}
                    y={baseline + 20}
                    textAnchor="middle"
                    fontSize={14}
                    className="fill-muted-foreground"
                  >
                    {formatMonthShort(point.month)}
                  </text>
                  {showYear && (
                    <text
                      x={slotX + slot / 2}
                      y={baseline + 38}
                      textAnchor="middle"
                      fontSize={14}
                      className="fill-muted-foreground"
                    >
                      {point.month.slice(0, 4)}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Area sorot selebar satu bulan (jauh lebih besar dari kolomnya) untuk pointer dan keyboard. */}
            {points.map((point, index) => (
              <rect
                key={`hit-${point.month}`}
                x={MARGIN.left + index * slot}
                y={MARGIN.top}
                width={slot}
                height={PLOT_HEIGHT}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${formatMonth(point.month)}: ${point.weighed.ALL} balita ditimbang dari ${point.eligible.ALL} terdata`}
                onPointerEnter={() => setActive(index)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
              />
            ))}
          </svg>

          {activePoint && active !== null && (
            <div
              aria-hidden
              className="pointer-events-none absolute z-10 rounded-md bg-foreground px-3 py-2 text-sm text-background shadow-md"
              style={{
                left: `${((MARGIN.left + (tooltipOnRight ? active + 1 : active) * slot) / WIDTH) * 100}%`,
                top: `${((MARGIN.top + 8) / HEIGHT) * 100}%`,
                transform: tooltipOnRight
                  ? "translateX(8px)"
                  : "translateX(calc(-100% - 8px))",
                whiteSpace: "nowrap",
              }}
            >
              <span className="block text-background/80">
                {formatMonth(activePoint.month)}
              </span>
              <strong className="block text-base">
                {activePoint.weighed.ALL} balita ditimbang
              </strong>
              <span className="block text-background/80">
                dari {activePoint.eligible.ALL} terdata ·{" "}
                {formatPercent(
                  activePoint.weighed.ALL,
                  activePoint.eligible.ALL
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Hanya tampil bila grafik lebih lebar dari wadahnya (perlu digeser). */}
      <p className="hidden text-sm text-muted-foreground @max-[640px]:block">
        Geser grafik ke kiri untuk melihat bulan sebelumnya.
      </p>

      {/* Setiap nilai juga bisa dibaca tanpa hover: tabel pendamping grafik. */}
      <details className="rounded-lg border border-border px-3 py-2">
        <summary className="min-h-8 cursor-pointer text-base font-semibold">
          Lihat data sebagai tabel
        </summary>
        <Table className="mt-2">
          <TableHeader>
            <TableRow>
              <TableHead>Bulan</TableHead>
              <TableHead className="text-right">Terdata</TableHead>
              <TableHead className="text-right">Ditimbang</TableHead>
              <TableHead className="text-right">Persen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {points.map((point) => (
              <TableRow key={point.month}>
                <TableCell>{formatMonth(point.month)}</TableCell>
                <TableCell className="text-right font-mono">
                  {point.eligible.ALL}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {point.weighed.ALL}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatPercent(point.weighed.ALL, point.eligible.ALL)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </details>
    </figure>
  )
}
