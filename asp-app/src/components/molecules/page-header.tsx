import type { NavItem } from "@/lib/constants/navigation"
import { TONE_CLASSES } from "@/lib/constants/tones"
import { cn } from "@/lib/utils"

type PageHeaderProps = {
  item: NavItem
  /** Menggantikan deskripsi bawaan menu bila halaman butuh teks sendiri. */
  description?: string
}

/**
 * Judul halaman. h1 mengikuti skala skill: 32px di layar kecil, 40px mulai md.
 * Ikon berwarna bersifat dekoratif; judul teks yang membawa makna.
 */
export function PageHeader({ item, description }: PageHeaderProps) {
  return (
    <header className="flex items-start gap-3">
      <span
        aria-hidden
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-md",
          TONE_CLASSES[item.tone].chip
        )}
      >
        <item.icon className="size-5" />
      </span>
      <div className="space-y-1">
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          {item.title}
        </h1>
        <p className="text-base text-muted-foreground">
          {description ?? item.description}
        </p>
      </div>
    </header>
  )
}
