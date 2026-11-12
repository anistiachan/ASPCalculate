import type { Metadata } from "next"

import { BackLink } from "@/components/molecules/back-link"
import { PageHeader } from "@/components/molecules/page-header"
import { ChildForm } from "@/features/children/components/child-form"
import { getNavItem } from "@/lib/constants/navigation"

export const metadata: Metadata = { title: "Tambah balita" }

export default function NewChildPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <BackLink href="/children">Daftar balita</BackLink>
      <PageHeader
        item={getNavItem("/children")}
        title="Tambah balita"
        description="Isi data dasar. Pengukuran ditambahkan setelah balita tersimpan."
      />
      <ChildForm mode="new" />
    </div>
  )
}
