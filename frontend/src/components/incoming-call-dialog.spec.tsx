import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { IncomingCallPayload } from "@base-dashboard/shared"
import { IncomingCallDialog } from "@/components/incoming-call-dialog"
import { declineCallApi } from "@/lib/calls"
import { useCallSocket } from "@/hooks/use-call-socket"

const navigate = vi.fn()

vi.mock("react-router", () => ({
  useNavigate: () => navigate,
  useLocation: () => ({ pathname: "/dashboard" }),
}))
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      key.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => String(opts?.[k] ?? "")),
  }),
}))
vi.mock("@/lib/calls", () => ({
  declineCallApi: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/hooks/use-call-socket", () => ({
  useCallSocket: vi.fn(),
}))

const clearIncomingCall = vi.fn()

function mockIncomingCall(call: IncomingCallPayload | null) {
  vi.mocked(useCallSocket).mockReturnValue({
    socket: null,
    incomingCall: call,
    clearIncomingCall,
  })
}

const sampleCall: IncomingCallPayload = {
  meetingId: "m1",
  caller: { id: "u1", firstName: "Ana" },
  ringExpiresAt: new Date(Date.now() + 60_000).toISOString(),
}

function renderDialog() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <IncomingCallDialog />
    </QueryClientProvider>,
  )
}

describe("IncomingCallDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom doesn't implement media playback.
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    HTMLMediaElement.prototype.pause = vi.fn()
  })

  it("shows the caller name and Accept/Decline actions when a call is ringing", () => {
    mockIncomingCall(sampleCall)
    renderDialog()

    expect(screen.getByText("Ana is calling…")).toBeTruthy()
    expect(screen.getByRole("button", { name: /Accept/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: /Decline/ })).toBeTruthy()
  })

  it("navigates into the call and clears the ring on Accept", () => {
    mockIncomingCall(sampleCall)
    renderDialog()

    fireEvent.click(screen.getByRole("button", { name: /Accept/ }))

    expect(navigate).toHaveBeenCalledWith("/call/m1")
    expect(clearIncomingCall).toHaveBeenCalled()
  })

  it("calls the decline endpoint and clears the ring on Decline", async () => {
    mockIncomingCall(sampleCall)
    renderDialog()

    fireEvent.click(screen.getByRole("button", { name: /Decline/ }))

    expect(clearIncomingCall).toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(vi.mocked(declineCallApi).mock.calls[0]?.[0]).toBe("m1"),
    )
  })

  it("renders nothing when there is no incoming call", () => {
    mockIncomingCall(null)
    renderDialog()

    expect(screen.queryByText(/is calling/)).toBeNull()
  })
})
