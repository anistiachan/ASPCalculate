import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/molecules/placeholder-page"
import { getNavItem } from "@/lib/constants/navigation"

export const metadata: Metadata = { title: "Pengaturan" }

export default function SettingsPage() {
  return <PlaceholderPage item={getNavItem("/settings")} />
}
