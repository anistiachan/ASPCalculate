import type { NavItem } from "@/lib/constants/navigation"
import { TONE_CLASSES } from "@/lib/constants/tones"
import { cn } from "@/lib/utils"

type PageHeaderProps = {
  /** Menu induk: menentukan ikon dan warna. */
  item: NavItem
  /** Menggantikan judul bawaan menu (mis. nama balita pada halaman detail). */
  title?: string
  /** Menggantikan deskripsi bawaan menu bila halaman butuh teks sendiri. */
  description?: string
}

/**
 * Judul halaman. h1 mengikuti skala skill: 32px di layar kecil, 40px mulai md.
 * Ikon berwarna bersifat dekoratif; judul teks yang membawa makna.
 */
export function PageHeader({ item, title, description }: PageHeaderProps) {
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
      <div className="min-w-0 space-y-1">
        <h1 className="font-heading text-3xl font-semibold tracking-tight break-words md:text-4xl">
          {title ?? item.title}
        </h1>
        <p className="text-base text-muted-foreground">
          {description ?? item.description}
        </p>
      </div>
    </header>
  )
}
