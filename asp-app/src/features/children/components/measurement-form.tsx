"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useId, useMemo } from "react"
import { useForm, useWatch } from "react-hook-form"

import { FormField } from "@/components/molecules/form-field"
import { RadioOptions } from "@/components/molecules/radio-options"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"
import { checkPlausibility } from "@/domain/measurement/plausibility"
import { getDb } from "@/infrastructure/storage/db"
import {
  createMeasurement,
  DuplicateMeasurementDateError,
  MeasurementBeforeBirthError,
  updateMeasurement,
} from "@/infrastructure/storage/repositories/child-repository"
import { completedMonths, todayIso } from "@/lib/date/completed-months"
import { parseDate } from "@/lib/date/parse-date"
import { formatAgeMonths } from "@/lib/format/format"
import { parseDecimal } from "@/lib/number/parse-decimal"

import { useChild, useMeasurement } from "../hooks/use-children-data"
import { POSITION_LABELS } from "../labels"
import {
  createMeasurementFormSchema,
  toMeasurementInput,
  type MeasurementFormInput,
  type MeasurementFormValues,
} from "../schemas/measurement-form.schema"
import { NotFoundCard } from "./not-found-card"

type MeasurementFormProps =
  | { mode: "new"; childId: string }
  | { mode: "edit"; childId: string; measurementId: string }

const POSITION_OPTIONS = [
  { value: "STANDING", label: POSITION_LABELS.STANDING },
  { value: "RECUMBENT", label: POSITION_LABELS.RECUMBENT },
  { value: "UNKNOWN", label: POSITION_LABELS.UNKNOWN },
] as const

export function MeasurementForm(props: MeasurementFormProps) {
  return props.mode === "new" ? (
    <NewMeasurementForm childId={props.childId} />
  ) : (
    <EditMeasurementForm
      childId={props.childId}
      measurementId={props.measurementId}
    />
  )
}

function Loading() {
  return <Skeleton className="h-96 w-full max-w-2xl" role="status" />
}

function ChildMissing() {
  return (
    <NotFoundCard
      title="Balita tidak ditemukan"
      description="Data ini tidak ada di perangkat ini. Mungkin sudah dihapus."
    />
  )
}

/**
 * Isian awal formulir tambah. Fungsi (bukan objek) agar tanggal hari ini dibaca ulang
 * setiap formulir dibuka, dan referensinya stabil sebagai dependensi efek.
 */
function newMeasurementDefaults(): MeasurementFormInput {
  return {
    // Tanggal hari ini sebagai awalan; pengguna cukup mengubahnya bila berbeda.
    measuredAt: todayIso(),
    weightKg: "",
    heightCm: "",
    // Cara ukur sengaja kosong: harus dipilih, tidak ditebak.
    position: "",
    lilaCm: "",
    headCm: "",
    note: "",
  }
}

function NewMeasurementForm({ childId }: { childId: string }) {
  const child = useChild(childId)
  if (child === undefined) return <Loading />
  if (child === null) return <ChildMissing />

  return (
    <MeasurementFormInner
      key={child.id}
      child={child}
      defaults={newMeasurementDefaults()}
      resetOnShow={newMeasurementDefaults}
    />
  )
}

const numberToText = (value: number | null) =>
  value === null ? "" : String(value)

function EditMeasurementForm({
  childId,
  measurementId,
}: {
  childId: string
  measurementId: string
}) {
  const child = useChild(childId)
  const measurement = useMeasurement(measurementId)

  if (child === undefined || measurement === undefined) return <Loading />
  if (child === null) return <ChildMissing />
  // Pengukuran harus milik anak pada URL; jika tidak, perlakukan sebagai tidak ada.
  if (measurement === null || measurement.childId !== child.id) {
    return (
      <NotFoundCard
        title="Pengukuran tidak ditemukan"
        description="Data pengukuran ini tidak ada. Mungkin sudah dihapus."
      />
    )
  }

  return (
    // `key` agar formulir diinisialisasi sekali per pengukuran.
    <MeasurementFormInner
      key={measurement.id}
      child={child}
      measurement={measurement}
      defaults={{
        measuredAt: measurement.measuredAt,
        weightKg: numberToText(measurement.weightKg),
        heightCm: numberToText(measurement.rawLengthHeightCm),
        position:
          measurement.measurementPosition === "UNKNOWN" &&
          measurement.rawLengthHeightCm === null
            ? ""
            : measurement.measurementPosition,
        lilaCm: numberToText(measurement.lilaCm),
        headCm: numberToText(measurement.headCircumferenceCm),
        note: measurement.rowNote ?? "",
      }}
    />
  )
}

type InnerProps = {
  child: StoredChild
  measurement?: StoredMeasurement
  defaults: MeasurementFormInput
  /** Hanya untuk formulir "tambah": isian dikosongkan lagi setiap halaman ditampilkan kembali. */
  resetOnShow?: () => MeasurementFormInput
}

function MeasurementFormInner({
  child,
  measurement,
  defaults,
  resetOnShow,
}: InnerProps) {
  const router = useRouter()
  const today = useMemo(() => todayIso(), [])
  const schema = useMemo(
    () => createMeasurementFormSchema({ birthDate: child.birthDate, today }),
    [child.birthDate, today]
  )
  const positionHintId = useId()
  const positionErrorId = useId()

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<MeasurementFormInput, unknown, MeasurementFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
    mode: "onTouched",
  })

  // Next.js menyimpan halaman yang ditinggalkan beserta state-nya; saat ditampilkan lagi
  // React menjalankan ulang efek. Formulir "tambah" dikosongkan lagi di sini (dengan
  // tanggal hari ini yang baru) supaya tidak menampilkan pengukuran yang baru disimpan.
  useEffect(() => {
    if (resetOnShow) reset(resetOnShow())
  }, [resetOnShow, reset])

  // Umur saat diukur dan peringatan kewajaran dihitung langsung dari isian.
  const [measuredAt, weight, height, lila, head] = useWatch({
    control,
    name: ["measuredAt", "weightKg", "heightCm", "lilaCm", "headCm"],
  })

  const ageAtMeasurement =
    measuredAt && parseDate(measuredAt).ok
      ? completedMonths(child.birthDate, measuredAt)
      : null

  const warnings = useMemo(() => {
    const number = (raw: string) => {
      const result = parseDecimal(raw)
      return result.ok ? result.value : null
    }
    return checkPlausibility({
      weightKg: number(weight ?? ""),
      heightCm: number(height ?? ""),
      lilaCm: number(lila ?? ""),
      headCm: number(head ?? ""),
    })
  }, [weight, height, lila, head])

  async function onSubmit(values: MeasurementFormValues) {
    clearErrors("root")
    const input = toMeasurementInput(values)
    try {
      if (measurement) {
        await updateMeasurement(getDb(), measurement.id, input)
      } else {
        await createMeasurement(getDb(), child.id, input)
      }
      router.push(`/children/${child.id}`)
    } catch (error) {
      if (error instanceof DuplicateMeasurementDateError) {
        setError("measuredAt", {
          message:
            "Sudah ada pengukuran pada tanggal ini. Ubah pengukuran yang ada, atau pilih tanggal lain.",
        })
      } else if (error instanceof MeasurementBeforeBirthError) {
        setError("measuredAt", {
          message: "Tanggal ukur tidak boleh lebih awal dari tanggal lahir.",
        })
      } else {
        // Detail error tidak ditampilkan: bisa memuat data pribadi.
        setError("root", {
          message:
            "Gagal menyimpan data. Tidak ada data yang berubah; coba lagi.",
        })
      }
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-5"
          aria-label={measurement ? "Ubah pengukuran" : "Tambah pengukuran"}
        >
          {errors.root?.message && (
            <Alert variant="destructive">
              <AlertTitle>Tidak bisa menyimpan</AlertTitle>
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              label="Tanggal ukur"
              required
              error={errors.measuredAt?.message}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  type="date"
                  min={child.birthDate}
                  max={today}
                  {...register("measuredAt")}
                />
              )}
            </FormField>
            <div className="space-y-1.5">
              <p className="text-base font-semibold">Umur saat diukur</p>
              <p role="status" className="flex h-10 items-center text-base">
                {ageAtMeasurement === null
                  ? "–"
                  : formatAgeMonths(ageAtMeasurement)}
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              label="Berat (kg)"
              hint="Boleh memakai koma, mis. 11,2"
              error={errors.weightKg?.message}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  inputMode="decimal"
                  autoComplete="off"
                  {...register("weightKg")}
                />
              )}
            </FormField>
            <FormField
              label="Panjang/tinggi (cm)"
              hint="Nilai hasil ukur apa adanya, tanpa koreksi"
              error={errors.heightCm?.message}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  inputMode="decimal"
                  autoComplete="off"
                  {...register("heightCm")}
                />
              )}
            </FormField>
          </div>

          <fieldset
            className="space-y-1.5"
            aria-describedby={
              errors.position ? positionErrorId : positionHintId
            }
          >
            <legend className="text-base font-semibold">Cara ukur</legend>
            <RadioOptions
              registration={register("position")}
              options={POSITION_OPTIONS}
              invalid={Boolean(errors.position)}
            />
            <p id={positionHintId} className="text-sm text-muted-foreground">
              Wajib dipilih bila tinggi diisi. Dipakai untuk koreksi
              panjang/tinggi pada perhitungan nanti; pilih &quot;Tidak
              diketahui&quot; bila tidak tercatat.
            </p>
            {errors.position && (
              <p
                id={positionErrorId}
                role="alert"
                className="text-sm font-semibold text-ink-danger"
              >
                {errors.position.message}
              </p>
            )}
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="LILA (cm)" error={errors.lilaCm?.message}>
              {(a11y) => (
                <Input
                  {...a11y}
                  inputMode="decimal"
                  autoComplete="off"
                  {...register("lilaCm")}
                />
              )}
            </FormField>
            <FormField
              label="Lingkar kepala (cm)"
              error={errors.headCm?.message}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  inputMode="decimal"
                  autoComplete="off"
                  {...register("headCm")}
                />
              )}
            </FormField>
          </div>

          <FormField label="Catatan" error={errors.note?.message}>
            {(a11y) => (
              <Input {...a11y} maxLength={200} {...register("note")} />
            )}
          </FormField>

          {warnings.length > 0 && (
            <Alert variant="warning" role="status">
              <AlertTitle>Periksa kembali angka ini</AlertTitle>
              <AlertDescription>
                <ul className="list-disc space-y-1 pl-5">
                  {warnings.map((warning) => (
                    <li key={warning.field}>{warning.message}</li>
                  ))}
                </ul>
                <p className="mt-2">
                  Ini hanya pengingat; data tetap bisa disimpan jika angkanya
                  sudah benar.
                </p>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Menyimpan…" : "Simpan"}
            </Button>
            <Button asChild variant="outline">
              <Link href={`/children/${child.id}`}>Batal</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
