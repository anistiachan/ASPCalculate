import type { Metadata } from "next"
import { Fredoka, Nunito, Space_Mono } from "next/font/google"

import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

// Font yang bersahabat tetapi tetap mudah dibaca semua usia:
// - Teks isi dan kontrol: Nunito (ujung huruf membulat, hangat, jelas di ukuran kecil).
// - Judul dan angka besar: Fredoka (bulat dan ceria).
// - Label kapital: Space Mono (skill docs/design/skill.md).
// Alasan menyimpang dari Noto Serif Display di skill ada di globals.css.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
})

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
})

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
})

export const metadata: Metadata = {
  title: {
    default: "OpenASP",
    template: "%s | OpenASP",
  },
  description:
    "Aplikasi pencatatan Posyandu dan antropometri balita. Data diproses di perangkat Anda.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${nunito.variable} ${fredoka.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  )
}
