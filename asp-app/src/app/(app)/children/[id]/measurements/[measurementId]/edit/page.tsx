import type { Metadata } from "next"
import { Suspense } from "react"

import { BackLink } from "@/components/molecules/back-link"
import { PageHeader } from "@/components/molecules/page-header"
import { MeasurementForm } from "@/features/children/components/measurement-form"
import { getNavItem } from "@/lib/constants/navigation"

export const metadata: Metadata = { title: "Ubah pengukuran" }

type Params =
  PageProps<"/children/[id]/measurements/[measurementId]/edit">["params"]

export default function EditMeasurementPage({ params }: { params: Params }) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        item={getNavItem("/measurements")}
        title="Ubah pengukuran"
        description="Perbarui hasil pengukuran yang sudah dicatat."
      />
      <Suspense fallback={<p role="status">Memuat…</p>}>
        <Content params={params} />
      </Suspense>
    </div>
  )
}

async function Content({ params }: { params: Params }) {
  const { id, measurementId } = await params
  return (
    <>
      <BackLink href={`/children/${id}`}>Kembali ke detail balita</BackLink>
      <MeasurementForm mode="edit" childId={id} measurementId={measurementId} />
    </>
  )
}
