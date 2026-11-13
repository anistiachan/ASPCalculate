import type { Metadata } from "next"

import { PageHeader } from "@/components/molecules/page-header"
import { ListsView } from "@/features/reports/components/lists-view"
import { getNavItem } from "@/lib/constants/navigation"

export const metadata: Metadata = { title: "Daftar Pantauan" }

export default function ListsPage() {
  return (
    <div className="w-full space-y-6">
      <PageHeader
        item={getNavItem("/lists")}
        description="Daftar balita per bulan: pendek, kurus, BGM, bermasalah, serta sasaran Vitamin A dan ASI eksklusif."
      />
      <ListsView />
    </div>
  )
}
