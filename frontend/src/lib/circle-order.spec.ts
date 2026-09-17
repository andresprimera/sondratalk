import type { Circle } from "@base-dashboard/shared"
import { pinnedFirst } from "@/lib/circle-order"

function circle(id: string): Circle {
  return {
    id,
    slug: id,
    themeId: null,
    type: "what-you-love",
    labels: { en: id, es: id },
    aliases: { en: [], es: [] },
    popularity: 0,
    isPrivate: false,
  }
}

const [a, b, c, d] = [circle("a"), circle("b"), circle("c"), circle("d")]

describe("pinnedFirst", () => {
  it("puts every pinned circle ahead of the catalog", () => {
    const result = pinnedFirst([a, b, c, d], [c, a])
    expect(result.map((x) => x.id)).toEqual(["c", "a", "b", "d"])
  })

  it("keeps pinned circles together even when the catalog interleaves them", () => {
    // The shape that broke before: pinned entries spread across catalog pages.
    const result = pinnedFirst([a, b, c, d], [b, d])
    expect(result.map((x) => x.id)).toEqual(["b", "d", "a", "c"])
  })

  it("preserves catalog order for the unpinned remainder", () => {
    const result = pinnedFirst([a, b, c, d], [])
    expect(result.map((x) => x.id)).toEqual(["a", "b", "c", "d"])
  })

  it("shows a pinned circle the catalog pages have not loaded yet", () => {
    const result = pinnedFirst([a, b], [d])
    expect(result.map((x) => x.id)).toEqual(["d", "a", "b"])
  })

  it("never renders a pinned circle twice", () => {
    const result = pinnedFirst([a, b, c], [b])
    expect(result.map((x) => x.id)).toEqual(["b", "a", "c"])
    expect(result.filter((x) => x.id === "b")).toHaveLength(1)
  })
})
