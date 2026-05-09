import { createElement, type ReactNode } from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  myAvailabilityKey,
  useUpdateMyAvailability,
} from "@/hooks/use-my-availability"
import {
  type Availability,
  updateMyAvailabilityApi,
} from "@/lib/availability"

vi.mock("@/lib/availability", async () => {
  const actual = await vi.importActual<typeof import("@/lib/availability")>(
    "@/lib/availability",
  )
  return {
    ...actual,
    updateMyAvailabilityApi: vi.fn(),
  }
})

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  return { client, wrapper }
}

describe("useUpdateMyAvailability", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("optimistically updates cache before the mutation resolves", async () => {
    const initial: Availability = { windows: [], isAvailableNow: false }
    let resolveFn: (value: Availability) => void = () => {}
    vi.mocked(updateMyAvailabilityApi).mockImplementation(
      () =>
        new Promise<Availability>((resolve) => {
          resolveFn = resolve
        }),
    )

    const { client, wrapper } = makeWrapper()
    client.setQueryData(myAvailabilityKey, initial)

    const { result } = renderHook(() => useUpdateMyAvailability(), { wrapper })

    act(() => {
      result.current.mutate({ isAvailableNow: true })
    })

    await waitFor(() => {
      const cached = client.getQueryData<Availability>(myAvailabilityKey)
      expect(cached?.isAvailableNow).toBe(true)
      expect(cached?.windows).toEqual([])
    })

    const serverResult: Availability = {
      windows: [],
      isAvailableNow: true,
    }
    resolveFn(serverResult)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(client.getQueryData<Availability>(myAvailabilityKey)).toEqual(
      serverResult,
    )
  })

  it("rolls back the cache and shows a toast on error", async () => {
    const initial: Availability = {
      windows: [{ period: "morning", day: "mon" }],
      isAvailableNow: false,
    }
    vi.mocked(updateMyAvailabilityApi).mockRejectedValue(
      new Error("Server exploded"),
    )

    const { client, wrapper } = makeWrapper()
    client.setQueryData(myAvailabilityKey, initial)

    const { result } = renderHook(() => useUpdateMyAvailability(), { wrapper })

    act(() => {
      result.current.mutate({ isAvailableNow: true })
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(client.getQueryData<Availability>(myAvailabilityKey)).toEqual(
      initial,
    )
    expect(toast.error).toHaveBeenCalledWith("Server exploded")
  })

  it("merges windows updates with existing isAvailableNow optimistically", async () => {
    const initial: Availability = {
      windows: [],
      isAvailableNow: true,
    }
    let resolveFn: (value: Availability) => void = () => {}
    vi.mocked(updateMyAvailabilityApi).mockImplementation(
      () =>
        new Promise<Availability>((resolve) => {
          resolveFn = resolve
        }),
    )

    const { client, wrapper } = makeWrapper()
    client.setQueryData(myAvailabilityKey, initial)

    const { result } = renderHook(() => useUpdateMyAvailability(), { wrapper })

    const newWindows = [{ period: "morning" as const, day: "mon" as const }]
    act(() => {
      result.current.mutate({ windows: newWindows })
    })

    await waitFor(() => {
      const cached = client.getQueryData<Availability>(myAvailabilityKey)
      expect(cached?.windows).toEqual(newWindows)
      expect(cached?.isAvailableNow).toBe(true)
    })

    resolveFn({ windows: newWindows, isAvailableNow: true })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
