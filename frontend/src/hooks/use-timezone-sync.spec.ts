import { createElement, type ReactNode } from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { type User } from "@base-dashboard/shared"
import { useTimezoneSync } from "@/hooks/use-timezone-sync"
import { useAuth } from "@/hooks/use-auth"
import { updateTimezoneApi } from "@/lib/profile"
import { getBrowserTimezone, getTimezoneByIana } from "@/lib/timezones"

vi.mock("@/hooks/use-auth", () => ({ useAuth: vi.fn() }))

vi.mock("@/lib/profile", () => ({ updateTimezoneApi: vi.fn() }))

vi.mock("@/lib/timezones", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/timezones")>("@/lib/timezones")
  return {
    ...actual,
    getBrowserTimezone: vi.fn(),
    getTimezoneByIana: vi.fn(),
  }
})

const updateUser = vi.fn()

function makeUser(timezone: string): User {
  return {
    id: "u1",
    email: "a@b.com",
    name: "Ana",
    role: "user",
    timezone,
    city: "",
    languages: [],
    locale: "en",
    createdAt: "2026-01-01T00:00:00.000Z",
    hostExpPoints: 0,
  }
}

function setAuth(user: User | null): void {
  vi.mocked(useAuth).mockReturnValue({
    user,
    isAuthenticated: !!user,
    isLoading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    updateUser,
  })
}

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  return wrapper
}

describe("useTimezoneSync", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getTimezoneByIana).mockReturnValue(undefined)
  })

  it("backfills the browser timezone when the stored zone is the UTC default", async () => {
    setAuth(makeUser("UTC"))
    vi.mocked(getBrowserTimezone).mockReturnValue("America/Caracas")
    vi.mocked(updateTimezoneApi).mockResolvedValue(makeUser("America/Caracas"))

    renderHook(() => useTimezoneSync(), { wrapper: makeWrapper() })

    await waitFor(() => expect(updateTimezoneApi).toHaveBeenCalled())
    expect(vi.mocked(updateTimezoneApi).mock.calls[0][0]).toEqual({
      timezone: "America/Caracas",
    })
    await waitFor(() => expect(updateUser).toHaveBeenCalledTimes(1))
  })

  it("includes the curated city when the detected zone resolves to one", async () => {
    setAuth(makeUser("UTC"))
    vi.mocked(getBrowserTimezone).mockReturnValue("America/Caracas")
    vi.mocked(getTimezoneByIana).mockReturnValue({
      iana: "America/Caracas",
      city: "Caracas",
      countryCode: "VE",
      abbr: "VET",
      utcOffsetMinutes: -240,
    })
    vi.mocked(updateTimezoneApi).mockResolvedValue(makeUser("America/Caracas"))

    renderHook(() => useTimezoneSync(), { wrapper: makeWrapper() })

    await waitFor(() => expect(updateTimezoneApi).toHaveBeenCalled())
    expect(vi.mocked(updateTimezoneApi).mock.calls[0][0]).toEqual({
      timezone: "America/Caracas",
      city: "Caracas",
    })
  })

  it("does nothing when the user already has a real timezone", () => {
    setAuth(makeUser("America/Caracas"))
    vi.mocked(getBrowserTimezone).mockReturnValue("Europe/Madrid")

    renderHook(() => useTimezoneSync(), { wrapper: makeWrapper() })

    expect(updateTimezoneApi).not.toHaveBeenCalled()
  })

  it("does nothing when the browser also reports UTC", () => {
    setAuth(makeUser("UTC"))
    vi.mocked(getBrowserTimezone).mockReturnValue("UTC")

    renderHook(() => useTimezoneSync(), { wrapper: makeWrapper() })

    expect(updateTimezoneApi).not.toHaveBeenCalled()
  })

  it("does nothing when unauthenticated", () => {
    setAuth(null)
    vi.mocked(getBrowserTimezone).mockReturnValue("Europe/Madrid")

    renderHook(() => useTimezoneSync(), { wrapper: makeWrapper() })

    expect(updateTimezoneApi).not.toHaveBeenCalled()
  })
})
