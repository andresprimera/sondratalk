import { fireEvent, render, screen } from "@testing-library/react"

const changeLanguage = vi.fn()

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage },
  }),
}))

// supportedLocales is a module-level const derived from an env var, so we
// re-import the component per test with a mocked locale list to exercise both
// the single-locale (hidden) and multi-locale (visible) branches.
async function renderWithLocales(locales: string[]) {
  vi.resetModules()
  vi.doMock("@/lib/i18n", () => ({ supportedLocales: locales }))
  const { LanguageToggle } = await import("@/components/language-toggle")
  return render(<LanguageToggle />)
}

describe("LanguageToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders nothing when only one locale is configured", async () => {
    const { container } = await renderWithLocales(["en"])
    expect(container.firstChild).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Change language" }),
    ).toBeNull()
  })

  it("renders a trigger when multiple locales are configured", async () => {
    await renderWithLocales(["en", "es"])
    expect(
      screen.getByRole("button", { name: "Change language" }),
    ).toBeTruthy()
  })

  it("switches the language when a locale is selected", async () => {
    await renderWithLocales(["en", "es"])
    fireEvent.click(screen.getByRole("button", { name: "Change language" }))
    fireEvent.click(await screen.findByText("Español"))
    expect(changeLanguage).toHaveBeenCalledWith("es")
  })
})
