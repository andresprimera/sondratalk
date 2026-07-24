import {
  themeSelectValueForCreate,
  themeSelectValueForUpdate,
} from "@/lib/circle-theme-select"

describe("themeSelectValueForCreate", () => {
  it("maps the 'No theme' sentinel to undefined", () => {
    expect(themeSelectValueForCreate("__none__")).toBeUndefined()
  })

  it("passes through a real theme id unchanged", () => {
    expect(themeSelectValueForCreate("theme-1")).toBe("theme-1")
  })
})

describe("themeSelectValueForUpdate", () => {
  it("maps the 'No theme' sentinel to null so the backend clears the theme", () => {
    expect(themeSelectValueForUpdate("__none__")).toBeNull()
  })

  it("passes through a real theme id unchanged", () => {
    expect(themeSelectValueForUpdate("theme-1")).toBe("theme-1")
  })
})
