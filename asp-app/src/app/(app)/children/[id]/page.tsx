import type { Metadata } from "next"
import { Suspense } from "react"

import { ChildDetail } from "@/features/children/components/child-detail"

export const metadata: Metadata = { title: "Detail balita" }

type Params = PageProps<"/children/[id]">["params"]

// `params` adalah data runtime (tidak ada generateStaticParams), jadi harus dibaca
// di dalam <Suspense>. Datanya sendiri dimuat di browser dari IndexedDB.
export default function ChildDetailPage({ params }: { params: Params }) {
  return (
    <div className="w-full">
      <Suspense fallback={<p role="status">Memuat…</p>}>
        <Content params={params} />
      </Suspense>
    </div>
  )
}

async function Content({ params }: { params: Params }) {
  const { id } = await params
  return <ChildDetail childId={id} />
}
