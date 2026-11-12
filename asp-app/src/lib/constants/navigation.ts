import {
  Baby,
  FileBarChart,
  FileUp,
  LayoutDashboard,
  Ruler,
  Settings,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  /** Phase di rencana pengembangan yang akan mengisi halaman ini. */
  plannedPhase: string
  description: string
}

export const APP_NAME = "OpenASP"

export function getNavItem(href: string): NavItem {
  const item = NAV_ITEMS.find((navItem) => navItem.href === href)
  if (!item) throw new Error(`Menu navigasi tidak ditemukan: ${href}`)
  return item
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    plannedPhase: "Phase 4",
    description: "Ringkasan aktivitas dan data bulan berjalan.",
  },
  {
    title: "Data Balita",
    href: "/children",
    icon: Baby,
    plannedPhase: "Phase 2",
    description: "Daftar, pencarian, tambah, edit, dan detail balita.",
  },
  {
    title: "Pengukuran",
    href: "/measurements",
    icon: Ruler,
    plannedPhase: "Phase 2",
    description:
      "Input dan riwayat pengukuran berat serta panjang/tinggi badan.",
  },
  {
    title: "Import Excel",
    href: "/import",
    icon: FileUp,
    plannedPhase: "Phase 1",
    description:
      "Pilih template, unggah file, tinjau pratinjau, lalu konfirmasi.",
  },
  {
    title: "Laporan",
    href: "/reports",
    icon: FileBarChart,
    plannedPhase: "Phase 4",
    description: "Rekap bulanan, SKDN, dan ekspor.",
  },
  {
    title: "Pengaturan",
    href: "/settings",
    icon: Settings,
    plannedPhase: "Phase 5",
    description: "Profil Posyandu, preferensi, backup, dan restore.",
  },
]
