import { SignupForm } from "@/components/signup-form"
import { Link } from "react-router"
import { ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"

const showLanding = import.meta.env.VITE_LANDING_PAGE !== "false"

export default function SignupPage() {
  const { t } = useTranslation()

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
        <SignupForm />
      </div>
    </div>
  )
}
