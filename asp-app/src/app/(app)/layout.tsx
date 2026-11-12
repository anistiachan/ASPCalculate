import { Suspense } from "react"

import { AppSidebar } from "@/components/organisms/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      {/*
        Sidebar membaca URL aktif (usePathname). Pada rute dinamis seperti
        /children/[id] nilainya baru diketahui saat permintaan, jadi harus di dalam
        Suspense. Kerangka menjaga lebar agar isi halaman tidak melompat.
      */}
      <Suspense
        fallback={
          <div
            aria-hidden
            className="hidden w-(--sidebar-width) shrink-0 border-r border-sidebar-border bg-sidebar md:block"
          />
        }
      >
        <AppSidebar />
      </Suspense>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-4">
          <SidebarTrigger aria-label="Buka atau tutup menu" />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm text-muted-foreground">
            Pencatatan Posyandu &amp; antropometri balita
          </span>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
