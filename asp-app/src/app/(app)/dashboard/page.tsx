import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/molecules/placeholder-page"
import { getNavItem } from "@/lib/constants/navigation"

export const metadata: Metadata = { title: "Dashboard" }

export default function DashboardPage() {
  return <PlaceholderPage item={getNavItem("/dashboard")} />
}
