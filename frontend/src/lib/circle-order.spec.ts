import type { Circle } from "@base-dashboard/shared"
import { selectedFirst } from "@/lib/circle-order"

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

describe("selectedFirst", () => {
  it("moves selected circles ahead of unselected ones", () => {
    const result = selectedFirst([a, b, c, d], [c])
    expect(result.map((x) => x.id)).toEqual(["c", "a", "b", "d"])
  })

  it("keeps catalog order within the selected and unselected groups", () => {
    const result = selectedFirst([a, b, c, d], [d, b])
    expect(result.map((x) => x.id)).toEqual(["b", "d", "a", "c"])
  })

  it("returns the catalog unchanged when nothing is selected", () => {
    const result = selectedFirst([a, b, c], [])
    expect(result.map((x) => x.id)).toEqual(["a", "b", "c"])
  })

  it("ignores selected circles that are not in the catalog page", () => {
    const result = selectedFirst([a, b], [c])
    expect(result.map((x) => x.id)).toEqual(["a", "b"])
  })
})
