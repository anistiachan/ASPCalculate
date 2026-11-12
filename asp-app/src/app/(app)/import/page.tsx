import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/molecules/placeholder-page"
import { getNavItem } from "@/lib/constants/navigation"

export const metadata: Metadata = { title: "Import Excel" }

export default function ImportPage() {
  return <PlaceholderPage item={getNavItem("/import")} />
}
