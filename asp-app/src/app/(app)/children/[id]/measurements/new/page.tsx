import type { Metadata } from "next"
import { Suspense } from "react"

import { BackLink } from "@/components/molecules/back-link"
import { PageHeader } from "@/components/molecules/page-header"
import { MeasurementForm } from "@/features/children/components/measurement-form"
import { getNavItem } from "@/lib/constants/navigation"

export const metadata: Metadata = { title: "Tambah pengukuran" }

type Params = PageProps<"/children/[id]/measurements/new">["params"]

export default function NewMeasurementPage({ params }: { params: Params }) {
  return (
    <div className="w-full space-y-6">
      <PageHeader
        item={getNavItem("/measurements")}
        title="Tambah pengukuran"
        description="Catat hasil pengukuran berat dan panjang/tinggi badan."
      />
      <Suspense fallback={<p role="status">Memuat…</p>}>
        <Content params={params} />
      </Suspense>
    </div>
  )
}

async function Content({ params }: { params: Params }) {
  const { id } = await params
  return (
    <>
      <BackLink href={`/children/${id}`}>Kembali ke detail balita</BackLink>
      <MeasurementForm mode="new" childId={id} />
    </>
  )
}
