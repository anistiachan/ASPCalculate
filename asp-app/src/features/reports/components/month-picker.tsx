"use client"

import { FormField } from "@/components/molecules/form-field"
import { NativeSelect } from "@/components/molecules/native-select"
import { Button } from "@/components/ui/button"
import { addMonths, type MonthKey } from "@/domain/reporting/monthly-recap"
import { formatMonthShort } from "@/lib/format/format"

type MonthPickerProps = {
  month: MonthKey
  /** Bulan berjalan; dipakai untuk pilihan cepat "Bulan ini" dan "Bulan lalu". */
  currentMonth: MonthKey
  /** Tahun yang bisa dipilih, urut turun. */
  years: number[]
  onChange: (month: MonthKey) => void
}

const MONTH_NUMBERS = Array.from({ length: 12 }, (_, i) => i + 1)

/**
 * Pemilih periode. Dua dropdown bawaan (bukan input type=month yang tidak tersedia di
 * semua browser) ditambah pilihan cepat. Letaknya satu baris di atas semua yang
 * dipengaruhinya (skill dataviz: filter di atas isi, bukan di dalam kartu).
 */
export function MonthPicker({
  month,
  currentMonth,
  years,
  onChange,
}: MonthPickerProps) {
  const [year, monthNumber] = month.split("-").map(Number)
  const pad = (n: number) => String(n).padStart(2, "0")
  const previous = addMonths(currentMonth, -1)

  return (
    <div className="flex flex-wrap items-end gap-3">
      <FormField label="Bulan">
        {(a11y) => (
          <NativeSelect
            {...a11y}
            value={monthNumber}
            onChange={(event) =>
              onChange(`${year}-${pad(Number(event.target.value))}`)
            }
          >
            {MONTH_NUMBERS.map((n) => (
              <option key={n} value={n}>
                {new Intl.DateTimeFormat("id-ID", {
                  month: "long",
                  timeZone: "UTC",
                }).format(new Date(Date.UTC(2000, n - 1, 1)))}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField label="Tahun">
        {(a11y) => (
          <NativeSelect
            {...a11y}
            value={year}
            onChange={(event) =>
              onChange(`${event.target.value}-${pad(monthNumber)}`)
            }
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <div className="flex gap-2 pb-0.5">
        <Button
          variant="outline"
          aria-pressed={month === currentMonth}
          onClick={() => onChange(currentMonth)}
        >
          Bulan ini
        </Button>
        <Button
          variant="outline"
          aria-pressed={month === previous}
          onClick={() => onChange(previous)}
          title={`Pilih ${formatMonthShort(previous)} ${previous.slice(0, 4)}`}
        >
          Bulan lalu
        </Button>
      </div>
    </div>
  )
}
