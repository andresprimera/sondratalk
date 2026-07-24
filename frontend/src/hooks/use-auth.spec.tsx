import { createElement, type ReactNode } from "react"
import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { type AuthResponse, type User } from "@base-dashboard/shared"
import { AuthProvider, useAuth } from "@/hooks/use-auth"
import {
  getStoredTokens,
  refreshTokens,
  clearTokens,
  getSessionEpoch,
} from "@/lib/api"
import { getTokenExpiry, isTokenExpiringSoon } from "@/lib/jwt"
import { ApiError } from "@/lib/api-error"

vi.mock("@/lib/api", () => ({
  getStoredTokens: vi.fn(),
  storeTokens: vi.fn(),
  clearTokens: vi.fn(),
  refreshTokens: vi.fn(),
  endSession: vi.fn(),
  getSessionEpoch: vi.fn(() => 0),
  TOKEN_KEYS: { access: "accessToken", refresh: "refreshToken" },
}))

vi.mock("@/lib/jwt", () => ({
  getTokenExpiry: vi.fn(),
  isTokenExpiringSoon: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  loginApi: vi.fn(),
  signupApi: vi.fn(),
  logoutApi: vi.fn(),
}))

const user: User = {
  id: "u1",
  email: "a@b.com",
  name: "Ana",
  role: "user",
  timezone: "UTC",
  city: "",
  languages: [],
  locale: "en",
  createdAt: "2026-01-01T00:00:00.000Z",
  hostExpPoints: 0,
}

const authResponse: AuthResponse = {
  accessToken: "a1",
  refreshToken: "r1",
  user,
}

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client },
      createElement(AuthProvider, null, children),
    )
}

// Render an already-authenticated provider: mount restores the session from the
// stored refresh token.
async function renderAuthed() {
  vi.mocked(getStoredTokens).mockReturnValue({
    accessToken: "a1",
    refreshToken: "r1",
  })
  vi.mocked(refreshTokens).mockResolvedValue(authResponse)

  const utils = renderHook(() => useAuth(), { wrapper: makeWrapper() })
  await waitFor(() => expect(utils.result.current.isAuthenticated).toBe(true))
  vi.mocked(refreshTokens).mockClear()
  return utils
}

describe("useAuth session hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Far-future expiry keeps the proactive timer dormant during tests.
    vi.mocked(getTokenExpiry).mockReturnValue(Date.now() + 15 * 60_000)
    vi.mocked(isTokenExpiringSoon).mockReturnValue(false)
    // clearAllMocks keeps implementations, so reset the epoch each test.
    vi.mocked(getSessionEpoch).mockReturnValue(0)
  })

  it("renews on network reconnect when the access token is stale", async () => {
    const { result } = await renderAuthed()
    vi.mocked(isTokenExpiringSoon).mockReturnValue(true)

    await act(async () => {
      window.dispatchEvent(new Event("online"))
    })

    await waitFor(() => expect(refreshTokens).toHaveBeenCalledTimes(1))
    expect(result.current.isAuthenticated).toBe(true)
  })

  it("does not hit the network when the tab regains focus with a fresh token", async () => {
    await renderAuthed()
    vi.mocked(isTokenExpiringSoon).mockReturnValue(false)

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
    })

    expect(refreshTokens).not.toHaveBeenCalled()
  })

  it("logs out when another tab clears the tokens", async () => {
    const { result } = await renderAuthed()

    // The other tab removed the tokens; our next read reflects that.
    vi.mocked(getStoredTokens).mockReturnValue({
      accessToken: null,
      refreshToken: null,
    })

    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: "refreshToken", newValue: null }),
      )
    })

    await waitFor(() => expect(result.current.isAuthenticated).toBe(false))
    expect(result.current.user).toBeNull()
  })

  it("ignores storage events for unrelated keys", async () => {
    const { result } = await renderAuthed()

    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: "theme", newValue: "dark" }),
      )
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(clearTokens).not.toHaveBeenCalled()
  })

  it("keeps the session on a transient refresh failure", async () => {
    const { result } = await renderAuthed()
    vi.mocked(isTokenExpiringSoon).mockReturnValue(true)
    vi.mocked(refreshTokens).mockRejectedValue(new Error("Network down"))

    await act(async () => {
      window.dispatchEvent(new Event("online"))
    })

    await waitFor(() => expect(refreshTokens).toHaveBeenCalled())
    expect(result.current.isAuthenticated).toBe(true)
    expect(clearTokens).not.toHaveBeenCalled()
  })

  it("signs out on a definitive auth failure", async () => {
    const { result } = await renderAuthed()
    vi.mocked(isTokenExpiringSoon).mockReturnValue(true)
    vi.mocked(refreshTokens).mockRejectedValue(
      new ApiError(401, "Access denied"),
    )

    await act(async () => {
      window.dispatchEvent(new Event("online"))
    })

    await waitFor(() => expect(result.current.isAuthenticated).toBe(false))
  })

  it("does not resurrect the session if a cross-tab logout lands mid-refresh", async () => {
    const { result } = await renderAuthed()
    vi.mocked(isTokenExpiringSoon).mockReturnValue(true)

    // Hold the refresh open so a logout can land while it is in flight.
    let resolveRefresh: (value: AuthResponse) => void = () => {}
    vi.mocked(refreshTokens).mockReturnValue(
      new Promise<AuthResponse>((resolve) => {
        resolveRefresh = resolve
      }),
    )

    await act(async () => {
      window.dispatchEvent(new Event("online"))
    })
    await waitFor(() => expect(refreshTokens).toHaveBeenCalled())

    // Another tab logs out while our refresh is still pending.
    vi.mocked(getStoredTokens).mockReturnValue({
      accessToken: null,
      refreshToken: null,
    })
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: "refreshToken", newValue: null }),
      )
    })
    expect(result.current.isAuthenticated).toBe(false)

    // The in-flight refresh now resolves with fresh tokens — it must NOT revive
    // the session the user just logged out everywhere.
    await act(async () => {
      resolveRefresh(authResponse)
      await Promise.resolve()
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it("recovers the session after a transient failure at mount", async () => {
    vi.mocked(getStoredTokens).mockReturnValue({
      accessToken: "a1",
      refreshToken: "r1",
    })
    // Mount restore fails transiently (network down / 5xx).
    vi.mocked(refreshTokens).mockRejectedValueOnce(new Error("Network down"))

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    // Stranded but tokens are preserved — not signed out.
    expect(result.current.isAuthenticated).toBe(false)

    // Network recovers; a focus event restores the session.
    vi.mocked(isTokenExpiringSoon).mockReturnValue(true)
    vi.mocked(refreshTokens).mockResolvedValue(authResponse)
    await act(async () => {
      window.dispatchEvent(new Event("focus"))
    })

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
  })

  it("does not resurrect a logged-out tab when tokens reappear", async () => {
    const { result } = await renderAuthed()

    // Cross-tab logout empties storage; this tab is now deliberately logged out.
    vi.mocked(getStoredTokens).mockReturnValue({
      accessToken: null,
      refreshToken: null,
    })
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: "refreshToken", newValue: null }),
      )
    })
    expect(result.current.isAuthenticated).toBe(false)

    // A logout's own token-rotation broadcast (or another tab logging in) makes
    // tokens reappear. The logged-out tab must NOT auto-adopt them — that was
    // the cross-tab resurrection bug. No refresh, stays signed out.
    vi.mocked(getStoredTokens).mockReturnValue({
      accessToken: "a2",
      refreshToken: "r2",
    })
    vi.mocked(isTokenExpiringSoon).mockReturnValue(true)
    vi.mocked(refreshTokens).mockClear()
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: "refreshToken", newValue: "r2" }),
      )
    })

    expect(refreshTokens).not.toHaveBeenCalled()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it("ignores a stale in-flight refresh whose session changed mid-flight", async () => {
    const { result } = await renderAuthed()
    vi.mocked(isTokenExpiringSoon).mockReturnValue(true)

    // Start a refresh, then advance the session generation while it is pending
    // (as a logout + re-login would). Its late result must be discarded, not
    // applied over the current state.
    let resolveRefresh: (value: AuthResponse) => void = () => {}
    vi.mocked(refreshTokens).mockReturnValue(
      new Promise<AuthResponse>((resolve) => {
        resolveRefresh = resolve
      }),
    )
    await act(async () => {
      window.dispatchEvent(new Event("online"))
    })
    await waitFor(() => expect(refreshTokens).toHaveBeenCalled())

    // The generation moves on under the in-flight refresh.
    vi.mocked(getSessionEpoch).mockReturnValue(1)
    await act(async () => {
      resolveRefresh({
        ...authResponse,
        user: { ...user, name: "Stale Ghost" },
      })
      await Promise.resolve()
    })

    // The stale user must NOT have been applied.
    expect(result.current.user?.name).not.toBe("Stale Ghost")
  })
})
