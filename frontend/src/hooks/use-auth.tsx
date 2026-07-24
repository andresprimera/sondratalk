import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import { type User } from "@base-dashboard/shared"
import {
  getStoredTokens,
  storeTokens,
  clearTokens,
  refreshTokens,
  beginSession,
  endSession,
  getSessionEpoch,
  TOKEN_KEYS,
} from "@/lib/api"
import { getTokenExpiry, getTokenSubject, isTokenExpiringSoon } from "@/lib/jwt"
import { ApiError } from "@/lib/api-error"
import { loginApi, signupApi, logoutApi } from "@/lib/auth"

// After a transient refresh failure, retry on this fixed interval rather than
// leaving the proactive renewal loop dead until an unrelated event fires. It
// keeps retrying (rate-limited) until it succeeds, the session ends, or the
// provider unmounts — a persistent outage self-heals when the backend returns.
const REFRESH_RETRY_MS = 30_000

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (
    name: string,
    email: string,
    password: string,
    timezone: string,
  ) => Promise<void>
  logout: () => Promise<void>
  updateUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// A refresh only ends the session when the server definitively rejects the
// refresh token (401/403). Transient network errors and 5xx must not sign the
// user out — the session is still valid and a later attempt will recover.
function isDefinitiveAuthFailure(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.statusCode === 401 || err.statusCode === 403)
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Mirror `user` into a ref so window/document event handlers (which capture
  // the value at subscription time) can read the current auth state.
  const userRef = useRef<User | null>(null)
  useEffect(() => {
    userRef.current = user
  }, [user])
  // Set once this tab has torn its session down (local logout or a cross-tab
  // logout). An already in-flight refresh checks this before committing so it
  // can't resurrect a session the user just logged out everywhere.
  const loggedOutRef = useRef(false)

  // Break the scheduleRefresh <-> attemptRefresh cycle: the timers read the
  // latest attempt fn from a ref, so both callbacks stay stable (empty deps).
  const attemptRefreshRef = useRef<() => Promise<void>>(async () => {})
  // False after unmount, so a refresh that resolves late doesn't setState or
  // re-arm a timer past teardown.
  const mountedRef = useRef(true)

  const scheduleRetry = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
    }
    refreshTimerRef.current = setTimeout(() => {
      void attemptRefreshRef.current()
    }, REFRESH_RETRY_MS)
  }, [])

  const scheduleRefresh = useCallback(
    (accessToken: string) => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }

      const expiry = getTokenExpiry(accessToken)
      if (!expiry) {
        // A token we can't read an expiry from — keep the loop alive with a
        // conservative retry rather than silently disarming it.
        scheduleRetry()
        return
      }

      // Refresh 1 minute before expiry, but never busy-loop: a very short or
      // misconfigured token TTL floors to a 5s poll instead of delay 0.
      const delay = Math.max(expiry - Date.now() - 60_000, 5_000)

      refreshTimerRef.current = setTimeout(() => {
        void attemptRefreshRef.current()
      }, delay)
    },
    [scheduleRetry],
  )

  // The single place that renews the session, shared by the proactive timer,
  // the event listeners, and mount. Captures the session generation so a result
  // that arrives after a logout / re-login is ignored instead of corrupting the
  // new state. On a definitive auth failure it signs out; on a transient one it
  // keeps the session and re-arms a bounded retry so the loop never silently
  // dies.
  const attemptRefresh = useCallback(async () => {
    const epoch = getSessionEpoch()
    try {
      const data = await refreshTokens()
      // Ignore a result that arrives after unmount, a logout, or a session
      // change — it must not overwrite the current state.
      if (
        !mountedRef.current ||
        loggedOutRef.current ||
        getSessionEpoch() !== epoch
      ) {
        return
      }
      setUser(data.user)
      scheduleRefresh(data.accessToken)
    } catch (err) {
      if (!mountedRef.current || getSessionEpoch() !== epoch) return
      if (isDefinitiveAuthFailure(err)) {
        // The session is dead (refreshTokens already cleared storage). Mark this
        // tab logged out so events don't keep retrying against dead tokens.
        loggedOutRef.current = true
        setUser(null)
      } else {
        scheduleRetry()
      }
    }
  }, [scheduleRefresh, scheduleRetry])

  useEffect(() => {
    attemptRefreshRef.current = attemptRefresh
  }, [attemptRefresh])

  // Tear down this tab's session in response to an external signal (a cross-tab
  // logout, or shared storage switching to a different user). Crucially it calls
  // endSession() so any refresh still in flight in THIS tab declines to persist
  // its result — every reactive sign-out must do this, or a concurrent refresh
  // clobbers the new owner's tokens. Does NOT clear storage: callers that own
  // the tokens (a mirrored logout) clear them; a different-user takeover must
  // leave the other user's tokens alone.
  const signOutLocally = useCallback(() => {
    endSession()
    loggedOutRef.current = true
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
    setUser(null)
  }, [])

  // Renew on demand when the tab regains attention or the network returns —
  // moments a background `setTimeout` is most likely to have lapsed (sleep,
  // throttling). Also the recovery path after a transient failure at mount, or
  // after another tab logs in. Respects a deliberate logout, but a tab that
  // merely failed to restore still recovers here.
  const refreshIfStale = useCallback(async () => {
    if (loggedOutRef.current) return

    const { accessToken, refreshToken } = getStoredTokens()
    if (!refreshToken) return

    if (userRef.current && accessToken) {
      if (getTokenSubject(accessToken) !== userRef.current.id) {
        // Shared storage now holds a different user's token — our session is
        // stale. Sign out rather than renew someone else's token.
        signOutLocally()
        return
      }
      if (!isTokenExpiringSoon(accessToken)) {
        // Signed in with plenty of runway — just make sure the timer is armed.
        scheduleRefresh(accessToken)
        return
      }
    }

    await attemptRefresh()
  }, [scheduleRefresh, attemptRefresh, signOutLocally])

  // Re-check freshness whenever the tab regains attention or the network comes
  // back — the moments where a background timer is most likely to have lapsed.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshIfStale()
    }
    const onFocus = () => void refreshIfStale()
    const onOnline = () => void refreshIfStale()

    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onFocus)
    window.addEventListener("online", onOnline)

    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("online", onOnline)
    }
  }, [refreshIfStale])

  // Keep tabs in sync. `storage` fires only in *other* tabs, so when one tab
  // logs out we mirror it here, and when one tab rotates the tokens we realign
  // our timer to the new access token instead of firing a redundant refresh.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      // Ignore unrelated keys; a null key means localStorage was cleared.
      if (
        e.key !== null &&
        e.key !== TOKEN_KEYS.access &&
        e.key !== TOKEN_KEYS.refresh
      ) {
        return
      }

      const { accessToken, refreshToken } = getStoredTokens()
      if (!refreshToken) {
        // Logged out elsewhere — mirror it (signOutLocally ends the session so
        // an in-flight refresh here can't write fresh tokens back), then clear
        // any tokens a racing refresh may have resurrected.
        signOutLocally()
        clearTokens()
        return
      }

      if (userRef.current && !loggedOutRef.current && accessToken) {
        if (getTokenSubject(accessToken) === userRef.current.id) {
          // Same user, another tab rotated the token — realign our timer to it
          // rather than firing a duplicate refresh.
          scheduleRefresh(accessToken)
        } else {
          // A DIFFERENT user now owns shared storage — this tab's session is
          // stale. Sign out rather than adopt: adopting would renew/display the
          // wrong identity, and a reload restores whoever storage now belongs to.
          // signOutLocally ends the session so an in-flight refresh here can't
          // clobber the new owner's tokens.
          signOutLocally()
        }
      }
      // Tokens appearing while this tab is signed out are deliberately NOT
      // adopted here: doing so would let a logout's own token-rotation broadcast
      // resurrect the session across tabs. A tab that never deliberately logged
      // out (e.g. a failed mount restore leaves loggedOutRef false) still
      // recovers on its next focus/online via refreshIfStale, which re-reads
      // storage; a deliberately logged-out tab stays out until it reloads.
    }

    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [scheduleRefresh, signOutLocally])

  // On mount: try to restore the session from the stored refresh token.
  // attemptRefresh handles all three outcomes — success signs in, a definitive
  // failure stays signed out, and a transient failure re-arms a retry so a
  // flaky network at load self-heals instead of stranding a valid session.
  useEffect(() => {
    const { refreshToken } = getStoredTokens()
    if (!refreshToken) {
      setIsLoading(false)
      return
    }

    attemptRefresh().finally(() => {
      setIsLoading(false)
    })
  }, [attemptRefresh])

  // Cleanup on unmount: stop the timer and mark unmounted so a late-resolving
  // refresh doesn't setState or re-arm a timer.
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginApi(email, password)
    // Start a new session generation so any refresh still in flight from a
    // just-ended session can't overwrite these tokens.
    beginSession()
    loggedOutRef.current = false
    queryClient.clear()
    storeTokens(data.accessToken, data.refreshToken)
    setUser(data.user)
    scheduleRefresh(data.accessToken)
  }, [scheduleRefresh, queryClient])

  const signup = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      timezone: string,
    ) => {
      const data = await signupApi(name, email, password, timezone)
      beginSession()
      loggedOutRef.current = false
      queryClient.clear()
      storeTokens(data.accessToken, data.refreshToken)
      setUser(data.user)
      scheduleRefresh(data.accessToken)
    },
    [scheduleRefresh, queryClient],
  )

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser)
  }, [])

  const logout = useCallback(async () => {
    // End the session generation first so every in-flight refresh (proactive
    // timer or call socket) aborts its write-back immediately.
    loggedOutRef.current = true
    endSession()
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
    // Tear the UI down synchronously so a slow logout request never leaves the
    // user looking signed in. Tokens stay in storage until logoutApi() finishes
    // so the request can still authenticate (best-effort; no refresh) to remove
    // the server-side session.
    setUser(null)
    queryClient.clear()
    await logoutApi().catch(() => {})
    // Only clear if the user hasn't logged back in during the request — login()
    // resets loggedOutRef, so a still-set flag means the logout still stands.
    // clearTokens() broadcasts the storage change that logs every tab out.
    if (loggedOutRef.current) {
      clearTokens()
    }
  }, [queryClient])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
