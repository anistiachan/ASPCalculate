import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/molecules/placeholder-page"
import { getNavItem } from "@/lib/constants/navigation"

export const metadata: Metadata = { title: "Laporan" }

export default function ReportsPage() {
  return <PlaceholderPage item={getNavItem("/reports")} />
}
