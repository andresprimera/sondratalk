import { Navigate } from "react-router"
import { useAuth } from "@/hooks/use-auth"
import { Skeleton } from "@/components/ui/skeleton"
import type { ReactNode } from "react"

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}
