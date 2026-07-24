import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Socket } from "socket.io-client"
import {
  CALL_SOCKET_EVENTS,
  incomingCallPayloadSchema,
  type IncomingCallPayload,
} from "@base-dashboard/shared"
import { getStoredTokens, refreshTokens } from "@/lib/api"
import { ApiError } from "@/lib/api-error"
import { createCallSocket } from "@/lib/socket"
import { useAuth } from "@/hooks/use-auth"

interface CallSocketContextValue {
  socket: Socket | null
  incomingCall: IncomingCallPayload | null
  clearIncomingCall: () => void
}

const CallSocketContext = createContext<CallSocketContextValue | null>(null)

export function CallSocketProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(
    null,
  )

  const clearIncomingCall = useCallback(() => setIncomingCall(null), [])

  useEffect(() => {
    if (!isAuthenticated) return
    const { accessToken } = getStoredTokens()
    if (!accessToken) return

    const s = createCallSocket(accessToken)
    // Refresh the token at most once per disconnected streak so a server
    // outage doesn't trigger a tight refresh loop.
    let refreshedThisStreak = false

    const handleConnect = () => {
      refreshedThisStreak = false
    }

    const handleConnectError = () => {
      // Most likely the access token expired between sessions. Refresh and
      // update the handshake auth; socket.io's auto-reconnect carries the new
      // token on its next attempt. If refresh fails, AuthProvider logs out
      // (flipping isAuthenticated → this effect tears the socket down).
      if (refreshedThisStreak) return
      refreshedThisStreak = true
      refreshTokens()
        .then(({ accessToken: next }) => {
          s.auth = { token: next }
        })
        .catch((err: unknown) => {
          // Transient failure (network / 5xx / a refresh superseded by another
          // flow): let the next reconnect attempt try again. A definitive
          // failure means the session is dead — leave the flag set so we don't
          // spin; AuthProvider's own renewal notices and signs the user out.
          if (
            !(
              err instanceof ApiError &&
              (err.statusCode === 401 || err.statusCode === 403)
            )
          ) {
            refreshedThisStreak = false
          }
        })
    }

    const handleIncomingCall = (raw: unknown) => {
      const parsed = incomingCallPayloadSchema.safeParse(raw)
      if (parsed.success) setIncomingCall(parsed.data)
    }

    s.on("connect", handleConnect)
    s.on("connect_error", handleConnectError)
    s.on(CALL_SOCKET_EVENTS.incomingCall, handleIncomingCall)
    s.connect()
    setSocket(s)

    return () => {
      s.off("connect", handleConnect)
      s.off("connect_error", handleConnectError)
      s.off(CALL_SOCKET_EVENTS.incomingCall, handleIncomingCall)
      s.disconnect()
      setSocket(null)
    }
  }, [isAuthenticated])

  // Auto-dismiss the ring once it expires server-side, so a stale ring (caller
  // gave up) doesn't linger on the callee's screen.
  useEffect(() => {
    if (!incomingCall) return
    const remaining =
      new Date(incomingCall.ringExpiresAt).getTime() - Date.now()
    if (remaining <= 0) {
      setIncomingCall(null)
      return
    }
    const timer = setTimeout(() => setIncomingCall(null), remaining)
    return () => clearTimeout(timer)
  }, [incomingCall])

  const value = useMemo<CallSocketContextValue>(
    () => ({ socket, incomingCall, clearIncomingCall }),
    [socket, incomingCall, clearIncomingCall],
  )

  return (
    <CallSocketContext.Provider value={value}>
      {children}
    </CallSocketContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCallSocket() {
  const context = useContext(CallSocketContext)
  if (!context) {
    throw new Error("useCallSocket must be used within a CallSocketProvider")
  }
  return context
}
