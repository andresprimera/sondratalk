import { act, renderHook } from "@testing-library/react"
import type { Socket } from "socket.io-client"
import { CALL_SOCKET_EVENTS } from "@base-dashboard/shared"
import { createCallSocket } from "@/lib/socket"
import { CallSocketProvider, useCallSocket } from "@/hooks/use-call-socket"

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}))
vi.mock("@/lib/socket", () => ({
  createCallSocket: vi.fn(),
}))
vi.mock("@/lib/api", () => ({
  getStoredTokens: () => ({ accessToken: "tok", refreshToken: "ref" }),
  refreshTokens: vi.fn(),
}))

type Handler = (arg: unknown) => void

function makeFakeSocket() {
  const handlers: Record<string, Handler[]> = {}
  return {
    auth: {} as Record<string, unknown>,
    on(event: string, cb: Handler) {
      ;(handlers[event] ??= []).push(cb)
    },
    off(event: string, cb: Handler) {
      handlers[event] = (handlers[event] ?? []).filter((h) => h !== cb)
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
    trigger(event: string, arg: unknown) {
      ;(handlers[event] ?? []).forEach((h) => h(arg))
    },
  }
}

const futureRing = () => new Date(Date.now() + 60_000).toISOString()

describe("useCallSocket", () => {
  let fakeSocket: ReturnType<typeof makeFakeSocket>

  beforeEach(() => {
    vi.clearAllMocks()
    fakeSocket = makeFakeSocket()
    vi.mocked(createCallSocket).mockReturnValue(
      fakeSocket as unknown as Socket,
    )
  })

  it("sets incomingCall when a valid incoming-call event arrives", () => {
    const { result } = renderHook(() => useCallSocket(), {
      wrapper: CallSocketProvider,
    })

    act(() => {
      fakeSocket.trigger(CALL_SOCKET_EVENTS.incomingCall, {
        meetingId: "m1",
        caller: { id: "u1", firstName: "Ana" },
        ringExpiresAt: futureRing(),
      })
    })

    expect(result.current.incomingCall?.meetingId).toBe("m1")
    expect(result.current.incomingCall?.caller.firstName).toBe("Ana")
  })

  it("ignores malformed incoming-call payloads", () => {
    const { result } = renderHook(() => useCallSocket(), {
      wrapper: CallSocketProvider,
    })

    act(() => {
      fakeSocket.trigger(CALL_SOCKET_EVENTS.incomingCall, { nonsense: true })
    })

    expect(result.current.incomingCall).toBeNull()
  })

  it("clears the incoming call via clearIncomingCall", () => {
    const { result } = renderHook(() => useCallSocket(), {
      wrapper: CallSocketProvider,
    })

    act(() => {
      fakeSocket.trigger(CALL_SOCKET_EVENTS.incomingCall, {
        meetingId: "m1",
        caller: { id: "u1", firstName: "Ana" },
        ringExpiresAt: futureRing(),
      })
    })
    expect(result.current.incomingCall).not.toBeNull()

    act(() => {
      result.current.clearIncomingCall()
    })
    expect(result.current.incomingCall).toBeNull()
  })
})
