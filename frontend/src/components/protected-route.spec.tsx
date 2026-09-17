import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { ProtectedRoute } from "@/components/protected-route"

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  isReconnecting: boolean
}

// Hoisted so the mock factory (which runs before the module body) can read it,
// letting each test swap in the auth state it wants to exercise.
const auth = vi.hoisted(() => ({
  state: {
    isAuthenticated: false,
    isLoading: false,
    isReconnecting: false,
  },
}))

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => auth.state,
}))

function renderGuard(state: AuthState) {
  auth.state = state
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <p>dashboard</p>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<p>login page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("ProtectedRoute", () => {
  it("renders the page once the session is restored", () => {
    renderGuard({
      isAuthenticated: true,
      isLoading: false,
      isReconnecting: false,
    })
    expect(screen.getByText("dashboard")).toBeDefined()
  })

  it("redirects to login when there is no session", () => {
    renderGuard({
      isAuthenticated: false,
      isLoading: false,
      isReconnecting: false,
    })
    expect(screen.getByText("login page")).toBeDefined()
  })

  it("waits instead of redirecting while a session is still being restored", () => {
    renderGuard({
      isAuthenticated: false,
      isLoading: true,
      isReconnecting: false,
    })
    expect(screen.queryByText("login page")).toBeNull()
    expect(screen.queryByText("dashboard")).toBeNull()
  })

  // The regression this guard exists for: a refresh that failed transiently
  // used to fall through to the redirect, so a returning user landed on the
  // login form with a perfectly valid session still in storage.
  it("waits and offers a manual sign-in while reconnecting, instead of redirecting", () => {
    renderGuard({
      isAuthenticated: false,
      isLoading: false,
      isReconnecting: true,
    })
    expect(screen.queryByText("login page")).toBeNull()
    expect(screen.getByText("Reconnecting…")).toBeDefined()
    // Rendered as an anchor carrying Base UI's button semantics, per the
    // repo's Button + render={<Link/>} + nativeButton={false} pattern.
    const escapeHatch = screen.getByRole("button", { name: "Log in" })
    expect(escapeHatch.getAttribute("href")).toBe("/login")
  })
})
