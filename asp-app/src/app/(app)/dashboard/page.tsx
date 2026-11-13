import type { Metadata } from "next"

import { PageHeader } from "@/components/molecules/page-header"
import { DashboardView } from "@/features/reports/components/dashboard-view"
import { getNavItem } from "@/lib/constants/navigation"

export const metadata: Metadata = { title: "Dashboard" }

export default function DashboardPage() {
  return (
    <div className="w-full space-y-6">
      <PageHeader
        item={getNavItem("/dashboard")}
        description="Ringkasan balita, penimbangan, dan status gizi bulan berjalan."
      />
      <DashboardView />
    </div>
  )
}
