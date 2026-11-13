import type { Metadata } from "next"

import { PageHeader } from "@/components/molecules/page-header"
import { ImportWizard } from "@/features/excel-import/components/import-wizard"
import { getNavItem } from "@/lib/constants/navigation"

export const metadata: Metadata = { title: "Import Excel" }

export default function ImportPage() {
  return (
    <div className="w-full space-y-6">
      <PageHeader
        item={getNavItem("/import")}
        description="Pilih file, tinjau pratinjau dan catatannya, lalu konfirmasi untuk menyimpan."
      />
      <ImportWizard />
    </div>
  )
}
