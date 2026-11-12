import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/molecules/placeholder-page"
import { getNavItem } from "@/lib/constants/navigation"

export const metadata: Metadata = { title: "Data Balita" }

export default function ChildrenPage() {
  return <PlaceholderPage item={getNavItem("/children")} />
}
