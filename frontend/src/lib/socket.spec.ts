import { io } from "socket.io-client"
import { createCallSocket } from "@/lib/socket"

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({})),
}))

describe("createCallSocket", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates a socket with autoConnect off and the token in the handshake auth", () => {
    createCallSocket("tok123")

    expect(io).toHaveBeenCalledTimes(1)
    // io is called as io(options) or io(url, options) depending on env — the
    // options object is always the last argument.
    const args = vi.mocked(io).mock.calls[0]
    const options = args[args.length - 1]
    expect(options).toEqual({
      autoConnect: false,
      auth: { token: "tok123" },
    })
  })
})
