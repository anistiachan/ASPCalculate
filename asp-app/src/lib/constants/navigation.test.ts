import { describe, expect, it } from "vitest"

import { NAV_ITEMS, getNavItem } from "./navigation"

describe("navigation", () => {
  it("memiliki href unik yang diawali garis miring", () => {
    const hrefs = NAV_ITEMS.map((item) => item.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
    for (const href of hrefs) expect(href.startsWith("/")).toBe(true)
  })

  it("mengembalikan menu sesuai href", () => {
    expect(getNavItem("/import").title).toBe("Import Excel")
  })

  it("melempar error untuk href yang tidak dikenal", () => {
    expect(() => getNavItem("/tidak-ada")).toThrow()
  })
})
