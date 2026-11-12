import {
  Baby,
  FileBarChart,
  FileUp,
  LayoutDashboard,
  Ruler,
  Settings,
  type LucideIcon,
} from "lucide-react"

import type { Tone } from "./tones"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  /** Warna pendamping menu dan judul halaman. */
  tone: Tone
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
    tone: "sky",
    plannedPhase: "Phase 4",
    description: "Ringkasan aktivitas dan data bulan berjalan.",
  },
  {
    title: "Data Balita",
    href: "/children",
    icon: Baby,
    tone: "pink",
    plannedPhase: "Phase 2",
    description: "Daftar, pencarian, tambah, edit, dan detail balita.",
  },
  {
    title: "Pengukuran",
    href: "/measurements",
    icon: Ruler,
    tone: "green",
    plannedPhase: "Phase 2",
    description:
      "Input dan riwayat pengukuran berat serta panjang/tinggi badan.",
  },
  {
    title: "Import Excel",
    href: "/import",
    icon: FileUp,
    tone: "butter",
    plannedPhase: "Phase 1",
    description:
      "Pilih template, unggah file, tinjau pratinjau, lalu konfirmasi.",
  },
  {
    title: "Laporan",
    href: "/reports",
    icon: FileBarChart,
    tone: "lavender",
    plannedPhase: "Phase 4",
    description: "Rekap bulanan, SKDN, dan ekspor.",
  },
  {
    title: "Pengaturan",
    href: "/settings",
    icon: Settings,
    tone: "neutral",
    plannedPhase: "Phase 5",
    description: "Profil Posyandu, preferensi, backup, dan restore.",
  },
]
