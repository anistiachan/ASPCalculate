"use client"

import { FormField } from "@/components/molecules/form-field"
import { NativeSelect } from "@/components/molecules/native-select"

import { ALL_POSYANDU } from "../services/posyandu-filter"

type PosyanduPickerProps = {
  options: string[]
  value: string
  onChange: (value: string) => void
}

/** Saringan Posyandu; hanya ditampilkan bila data memuat nama Posyandu. */
export function PosyanduPicker({
  options,
  value,
  onChange,
}: PosyanduPickerProps) {
  if (options.length === 0) return null
  return (
    <FormField label="Posyandu">
      {(a11y) => (
        <NativeSelect
          {...a11y}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value={ALL_POSYANDU}>Semua Posyandu</option>
          {options.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </NativeSelect>
      )}
    </FormField>
  )
}
