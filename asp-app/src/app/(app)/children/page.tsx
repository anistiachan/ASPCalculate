import type { Metadata } from "next"

import { PageHeader } from "@/components/molecules/page-header"
import { ChildrenList } from "@/features/children/components/children-list"
import { getNavItem } from "@/lib/constants/navigation"

export const metadata: Metadata = { title: "Data Balita" }

export default function ChildrenPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        item={getNavItem("/children")}
        description="Cari, lihat, dan kelola data balita serta riwayat pengukurannya."
      />
      <ChildrenList />
    </div>
  )
}
