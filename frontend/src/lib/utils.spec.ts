import { getInitials, isNavActive } from "@/lib/utils"

describe("isNavActive", () => {
  describe("prefix matching (default)", () => {
    it("matches the exact path", () => {
      expect(isNavActive("/dashboard/circles", "/dashboard/circles")).toBe(true)
    })

    it("matches a nested child path", () => {
      expect(
        isNavActive("/dashboard/circles/123/schedule", "/dashboard/circles"),
      ).toBe(true)
    })

    it("does not match an unrelated path", () => {
      expect(isNavActive("/dashboard/users", "/dashboard/circles")).toBe(false)
    })

    it("does not match a sibling that merely shares a prefix string", () => {
      expect(isNavActive("/dashboard/circles-extra", "/dashboard/circles")).toBe(
        false,
      )
    })
  })

  describe("exact matching (end: true)", () => {
    it("matches only the exact path", () => {
      expect(isNavActive("/dashboard", "/dashboard", { end: true })).toBe(true)
    })

    it("does not light up on child routes", () => {
      expect(
        isNavActive("/dashboard/users", "/dashboard", { end: true }),
      ).toBe(false)
    })
  })
})

describe("getInitials", () => {
  it("returns the first two initials uppercased", () => {
    expect(getInitials("Ada Lovelace")).toBe("AL")
  })

  it("caps at two characters for longer names", () => {
    expect(getInitials("Grace Brewster Hopper")).toBe("GB")
  })
})
