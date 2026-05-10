import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react"
import { type User } from "@base-dashboard/shared"
import { getStoredTokens, storeTokens, clearTokens } from "@/lib/api"
import { loginApi, signupApi, refreshApi, logoutApi } from "@/lib/auth"

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

// Decode JWT payload to get expiration time
function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]))
    return payload.exp ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleRefresh = useCallback((accessToken: string, refreshToken: string) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
    }

    const expiry = getTokenExpiry(accessToken)
    if (!expiry) return

    // Refresh 1 minute before expiry
    const delay = Math.max(expiry - Date.now() - 60_000, 0)

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const data = await refreshApi(refreshToken)
        storeTokens(data.accessToken, data.refreshToken)
        setUser(data.user)
        scheduleRefresh(data.accessToken, data.refreshToken)
      } catch {
        clearTokens()
        setUser(null)
      }
    }, delay)
  }, [])

  // On mount: try to restore session from stored refresh token
  useEffect(() => {
    const { refreshToken } = getStoredTokens()
    if (!refreshToken) {
      setIsLoading(false)
      return
    }

    refreshApi(refreshToken)
      .then((data) => {
        storeTokens(data.accessToken, data.refreshToken)
        setUser(data.user)
        scheduleRefresh(data.accessToken, data.refreshToken)
      })
      .catch(() => {
        clearTokens()
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [scheduleRefresh])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginApi(email, password)
    storeTokens(data.accessToken, data.refreshToken)
    setUser(data.user)
    scheduleRefresh(data.accessToken, data.refreshToken)
  }, [scheduleRefresh])

  const signup = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      timezone: string,
    ) => {
      const data = await signupApi(name, email, password, timezone)
      storeTokens(data.accessToken, data.refreshToken)
      setUser(data.user)
      scheduleRefresh(data.accessToken, data.refreshToken)
    },
    [scheduleRefresh],
  )

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser)
  }, [])

  const logout = useCallback(async () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
    }
    await logoutApi().catch(() => {})
    clearTokens()
    setUser(null)
  }, [])

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
