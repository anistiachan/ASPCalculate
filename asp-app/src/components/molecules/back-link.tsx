import { ArrowLeft } from "lucide-react"
import Link from "next/link"

type BackLinkProps = {
  href: string
  children: string
}

export function BackLink({ href, children }: BackLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-8 items-center gap-1.5 text-base font-semibold text-primary underline-offset-4 hover:underline"
    >
      <ArrowLeft aria-hidden className="size-4" />
      {children}
    </Link>
  )
}
