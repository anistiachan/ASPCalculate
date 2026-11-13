import type { Metadata } from "next"

import { PageHeader } from "@/components/molecules/page-header"
import { ReportsView } from "@/features/reports/components/reports-view"
import { getNavItem } from "@/lib/constants/navigation"

export const metadata: Metadata = { title: "Laporan" }

export default function ReportsPage() {
  return (
    <div className="w-full space-y-6">
      <PageHeader
        item={getNavItem("/reports")}
        description="Rekap bulanan: cakupan penimbangan, status gizi, dan Vitamin A. Bisa diunduh sebagai Excel."
      />
      <ReportsView />
    </div>
  )
}
