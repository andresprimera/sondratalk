import { LoginForm } from "@/components/login-form"
import { Link, Navigate } from "react-router"
import { ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/hooks/use-auth"

const showLanding = import.meta.env.VITE_LANDING_PAGE !== "false"

export default function LoginPage() {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuth()

  // Someone who is already signed in has no business staring at a login form —
  // most reachably, a user who left the reconnecting screen by hand and whose
  // background retry then succeeded.
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        {showLanding && (
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {t("Back to home")}
          </Link>
        )}
        <LoginForm />
      </div>
    </div>
  )
}
