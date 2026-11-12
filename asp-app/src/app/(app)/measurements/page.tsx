import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/molecules/placeholder-page"
import { getNavItem } from "@/lib/constants/navigation"

export const metadata: Metadata = { title: "Pengukuran" }

export default function MeasurementsPage() {
  return <PlaceholderPage item={getNavItem("/measurements")} />
}
