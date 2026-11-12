"use client"

import { HeartPulse } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { APP_NAME, NAV_ITEMS } from "@/lib/constants/navigation"
import { TONE_CLASSES } from "@/lib/constants/tones"
import { cn } from "@/lib/utils"

export function AppSidebar() {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex h-10 items-center gap-2 px-1">
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground"
          >
            <HeartPulse className="size-5" />
          </span>
          <span className="font-heading text-xl font-semibold group-data-[collapsible=icon]:hidden">
            {APP_NAME}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      // Target 40px (di atas minimum 24px WCAG 2.5.8) untuk sentuhan.
                      className="h-10"
                    >
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        // Tutup drawer setelah memilih menu di layar kecil.
                        onClick={() => {
                          if (isMobile) setOpenMobile(false)
                        }}
                      >
                        {/* Chip berwarna per bagian; saat sidebar dilipat hanya ikon yang tampil. */}
                        <span
                          aria-hidden
                          className={cn(
                            "grid size-7 shrink-0 place-items-center rounded-sm",
                            "group-data-[collapsible=icon]:size-4 group-data-[collapsible=icon]:bg-transparent",
                            TONE_CLASSES[item.tone].chip
                          )}
                        >
                          <item.icon />
                        </span>
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
