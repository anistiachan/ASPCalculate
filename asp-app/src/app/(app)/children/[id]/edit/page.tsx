import type { Metadata } from "next"
import { Suspense } from "react"

import { BackLink } from "@/components/molecules/back-link"
import { PageHeader } from "@/components/molecules/page-header"
import { ChildForm } from "@/features/children/components/child-form"
import { getNavItem } from "@/lib/constants/navigation"

export const metadata: Metadata = { title: "Ubah data balita" }

type Params = PageProps<"/children/[id]/edit">["params"]

export default function EditChildPage({ params }: { params: Params }) {
  return (
    <div className="w-full space-y-6">
      <PageHeader
        item={getNavItem("/children")}
        title="Ubah data balita"
        description="Perbarui data dasar balita."
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
      <ChildForm mode="edit" childId={id} />
    </>
  )
}
