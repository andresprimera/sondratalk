import { Link, Navigate } from "react-router"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { ReactNode } from "react"

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { isAuthenticated, isLoading, isReconnecting } = useAuth()

  // A session we hold a refresh token for but couldn't verify (backend down,
  // network dropped) is not a sign-out — redirecting here is what forces the
  // user to log in again on their next visit. Keep waiting instead: the auth
  // provider retries in the background and signs them in when it succeeds.
  const waiting = isLoading || (!isAuthenticated && isReconnecting)

  if (waiting) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        {isReconnecting && (
          <>
            <p className="text-sm text-muted-foreground">
              {t("Reconnecting…")}
            </p>
            {/* Never trap the user in the waiting state — signing in by hand
                stays available if the retry can't recover. */}
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link to="/login" />}
            >
              {t("Log in")}
            </Button>
          </>
        )}
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}
