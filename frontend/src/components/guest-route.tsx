import { useState, type ReactNode } from "react"
import { Navigate } from "react-router"
import { useAuth } from "@/hooks/use-auth"
import { getStoredTokens } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Wraps the pages a signed-in user has no reason to see — the marketing
 * landing and the login form — and sends them into the app instead. Coming
 * back to the site with a live session should drop you inside the platform;
 * being shown a "Log in" button is the friction this removes.
 */
export function GuestRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  // Read once, at mount: whether there is a session worth waiting for. Without
  // this an anonymous visitor would sit behind a spinner on the public landing
  // page while the auth provider settles, and a returning user would see the
  // marketing page flash before the redirect.
  //
  // Note this waits on isLoading only, not isReconnecting as ProtectedRoute
  // does. During a backend outage these pages render normally rather than
  // holding a public visitor behind an indefinite spinner; the redirect lands
  // if and when the background retry succeeds.
  const [hasStoredSession] = useState(
    () => getStoredTokens().refreshToken !== null,
  )

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  if (hasStoredSession && isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
    )
  }

  return children
}
