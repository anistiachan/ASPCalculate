import type { Metadata } from "next"

import { PageHeader } from "@/components/molecules/page-header"
import { BackupRestore } from "@/features/settings/components/backup-restore"
import { getNavItem } from "@/lib/constants/navigation"

export const metadata: Metadata = { title: "Pengaturan" }

export default function SettingsPage() {
  return (
    <div className="w-full space-y-6">
      <PageHeader
        item={getNavItem("/settings")}
        description="Cadangkan dan pulihkan data yang tersimpan di browser ini."
      />
      <BackupRestore />
    </div>
  )
}
