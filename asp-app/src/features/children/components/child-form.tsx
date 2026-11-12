"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useId, useMemo } from "react"
import { useForm } from "react-hook-form"

import { FormField } from "@/components/molecules/form-field"
import { RadioOptions } from "@/components/molecules/radio-options"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { StoredChild } from "@/domain/child/stored.types"
import { getDb } from "@/infrastructure/storage/db"
import {
  BirthDateConflictError,
  createChild,
  DuplicateNikError,
  updateChild,
} from "@/infrastructure/storage/repositories/child-repository"
import { todayIso } from "@/lib/date/completed-months"
import { useToday } from "@/lib/hooks/use-today"

import { useChild } from "../hooks/use-children-data"
import { SEX_LABELS } from "../labels"
import {
  createChildFormSchema,
  toChildInput,
  type ChildFormInput,
  type ChildFormValues,
} from "../schemas/child-form.schema"
import { NotFoundCard } from "./not-found-card"

type ChildFormProps = { mode: "new" } | { mode: "edit"; childId: string }

const SEX_OPTIONS = [
  { value: "M", label: SEX_LABELS.M },
  { value: "F", label: SEX_LABELS.F },
] as const

/** Konstanta di luar komponen agar referensinya stabil (dipakai sebagai dependensi efek). */
const EMPTY_CHILD_FORM: ChildFormInput = {
  name: "",
  birthDate: "",
  sex: "",
  nik: "",
}

export function ChildForm(props: ChildFormProps) {
  return props.mode === "new" ? (
    <NewChildForm />
  ) : (
    <EditChildForm childId={props.childId} />
  )
}

function NewChildForm() {
  // Formulir memakai tanggal hari ini (batas tanggal lahir). Tanggal tidak boleh dibaca
  // saat prerender, jadi formulir baru muncul setelah browser mengetahuinya.
  const today = useToday()
  if (today === null) {
    return <Skeleton className="h-96 w-full max-w-2xl" role="status" />
  }

  return <ChildFormInner key="new" mode="new" defaults={EMPTY_CHILD_FORM} />
}

function EditChildForm({ childId }: { childId: string }) {
  const child = useChild(childId)

  if (child === undefined) {
    return <Skeleton className="h-96 w-full max-w-2xl" role="status" />
  }
  if (child === null) {
    return (
      <NotFoundCard
        title="Balita tidak ditemukan"
        description="Data ini tidak ada di perangkat ini. Mungkin sudah dihapus."
      />
    )
  }
  return (
    // `key` agar formulir diinisialisasi sekali per anak.
    <ChildFormInner
      key={child.id}
      mode="edit"
      child={child}
      defaults={{
        name: child.name,
        birthDate: child.birthDate,
        sex: child.sex,
        nik: child.sourceKey ?? "",
      }}
    />
  )
}

type InnerProps = {
  defaults: ChildFormInput
} & ({ mode: "new" } | { mode: "edit"; child: StoredChild })

function ChildFormInner(props: InnerProps) {
  const router = useRouter()
  const today = useMemo(() => todayIso(), [])
  const schema = useMemo(() => createChildFormSchema(today), [today])
  const sexErrorId = useId()

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChildFormInput, unknown, ChildFormValues>({
    resolver: zodResolver(schema),
    defaultValues: props.defaults,
    mode: "onTouched",
  })

  // Next.js menyimpan halaman yang ditinggalkan (tersembunyi) beserta state-nya. Saat
  // halaman ditampilkan lagi, React menjalankan ulang efek. Formulir "tambah" harus
  // kosong lagi di sini, bukan menampilkan isian anak yang baru saja disimpan.
  const isNew = props.mode === "new"
  useEffect(() => {
    if (isNew) reset(EMPTY_CHILD_FORM)
  }, [isNew, reset])

  async function onSubmit(values: ChildFormValues) {
    clearErrors("root")
    const input = toChildInput(values)
    try {
      const saved =
        props.mode === "new"
          ? await createChild(getDb(), input)
          : await updateChild(getDb(), props.child.id, input)
      router.push(`/children/${saved.id}`)
    } catch (error) {
      if (error instanceof DuplicateNikError) {
        setError("nik", { message: "NIK ini sudah dipakai anak lain." })
      } else if (error instanceof BirthDateConflictError) {
        setError("birthDate", {
          message: `Tanggal lahir terlalu akhir: ada ${error.conflictingMeasurements} pengukuran sebelum tanggal itu. Ubah atau hapus pengukurannya dulu.`,
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

  const cancelHref =
    props.mode === "edit" ? `/children/${props.child.id}` : "/children"

  return (
    <Card className="max-w-2xl">
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-5"
          aria-label={
            props.mode === "new" ? "Tambah balita" : "Ubah data balita"
          }
        >
          {errors.root?.message && (
            <Alert variant="destructive">
              <AlertTitle>Tidak bisa menyimpan</AlertTitle>
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          )}

          <FormField label="Nama" required error={errors.name?.message}>
            {(a11y) => (
              <Input
                {...a11y}
                autoComplete="off"
                maxLength={100}
                {...register("name")}
              />
            )}
          </FormField>

          <FormField
            label="Tanggal lahir"
            required
            error={errors.birthDate?.message}
          >
            {(a11y) => (
              <Input
                {...a11y}
                type="date"
                max={today}
                className="max-w-xs"
                {...register("birthDate")}
              />
            )}
          </FormField>

          <fieldset
            className="space-y-1.5"
            aria-describedby={errors.sex ? sexErrorId : undefined}
          >
            <legend className="text-base font-semibold">
              Jenis kelamin
              <span aria-hidden className="text-ink-danger">
                {" "}
                *
              </span>
              <span className="sr-only"> (wajib diisi)</span>
            </legend>
            <RadioOptions
              registration={register("sex")}
              options={SEX_OPTIONS}
              invalid={Boolean(errors.sex)}
            />
            {errors.sex && (
              <p
                id={sexErrorId}
                role="alert"
                className="text-sm font-semibold text-ink-danger"
              >
                {errors.sex.message}
              </p>
            )}
          </fieldset>

          <FormField
            label="NIK"
            hint="Opsional, 16 digit. Dipakai untuk mengenali anak yang sama saat impor ulang. Disimpan hanya di perangkat ini."
            error={errors.nik?.message}
          >
            {(a11y) => (
              <Input
                {...a11y}
                inputMode="numeric"
                autoComplete="off"
                className="max-w-sm font-mono"
                {...register("nik")}
              />
            )}
          </FormField>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Menyimpan…" : "Simpan"}
            </Button>
            <Button asChild variant="outline">
              <Link href={cancelHref}>Batal</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
