import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { GuestRoute } from "@/components/guest-route"
import { getStoredTokens } from "@/lib/api"

// Hoisted so the mock factory can read it before the module body runs.
const auth = vi.hoisted(() => ({
  state: { isAuthenticated: false, isLoading: false },
}))

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => auth.state,
}))

vi.mock("@/lib/api", () => ({
  getStoredTokens: vi.fn(() => ({ accessToken: null, refreshToken: null })),
}))

function renderGuard(state: { isAuthenticated: boolean; isLoading: boolean }) {
  auth.state = state
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route
          path="/"
          element={
            <GuestRoute>
              <p>landing page</p>
            </GuestRoute>
          }
        />
        <Route path="/dashboard" element={<p>dashboard</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("GuestRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getStoredTokens).mockReturnValue({
      accessToken: null,
      refreshToken: null,
    })
  })

  it("sends a signed-in visitor straight into the app", () => {
    renderGuard({ isAuthenticated: true, isLoading: false })
    expect(screen.getByText("dashboard")).toBeDefined()
    expect(screen.queryByText("landing page")).toBeNull()
  })

  it("shows the public page to a visitor with no session", () => {
    renderGuard({ isAuthenticated: false, isLoading: false })
    expect(screen.getByText("landing page")).toBeDefined()
  })

  // Anonymous visitors are the common case on a public page: they must never
  // be held behind a spinner while the auth provider settles.
  it("does not hold an anonymous visitor back while auth is still loading", () => {
    renderGuard({ isAuthenticated: false, isLoading: true })
    expect(screen.getByText("landing page")).toBeDefined()
  })

  // A returning user, on the other hand, should not see the marketing page
  // flash before the redirect lands.
  it("waits for the session to restore when a refresh token is stored", () => {
    vi.mocked(getStoredTokens).mockReturnValue({
      accessToken: "a1",
      refreshToken: "r1",
    })
    renderGuard({ isAuthenticated: false, isLoading: true })
    expect(screen.queryByText("landing page")).toBeNull()
    expect(screen.queryByText("dashboard")).toBeNull()
  })
})
