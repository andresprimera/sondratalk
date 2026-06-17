import { io, type Socket } from "socket.io-client"

// Where the socket.io server lives. In dev this is empty, so the client
// connects to the Vite origin and the dev proxy forwards /socket.io to the
// backend (see vite.config.ts). In prod, set VITE_SOCKET_URL (or reuse
// VITE_API_URL — same backend origin) to connect directly.
const SOCKET_URL = (
  import.meta.env.VITE_SOCKET_URL ??
  import.meta.env.VITE_API_URL ??
  ""
).replace(/\/$/, "")

// The token is passed via the handshake `auth` payload (the idiomatic
// socket.io channel — not a query param, which would leak into logs). The
// gateway verifies it on connect. autoConnect is off so the provider owns the
// connection lifecycle.
export function createCallSocket(token: string): Socket {
  const options = { autoConnect: false, auth: { token } }
  return SOCKET_URL ? io(SOCKET_URL, options) : io(options)
}
