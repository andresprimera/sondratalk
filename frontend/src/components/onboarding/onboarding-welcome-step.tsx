import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"

export function OnboardingWelcomeStep() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()

  const firstName = user?.name.split(" ")[0] ?? ""

  return (
    <section className="mt-[10vh] flex flex-col items-center text-center">
      <div className="onboarding-welcome-logo mb-14">Sondra</div>
      <h1 className="onboarding-welcome-name mb-4">
        {t("Thank you, {{firstName}}.", { firstName })}
      </h1>
      <p className="onboarding-welcome-line mb-4">
        {t("Your application is in.")}
      </p>
      <p className="mb-12 max-w-sm text-balance text-sm text-muted-foreground">
        {t("if you're here, you are welcome")}
      </p>
      <Button
        size="xl"
        className="landing-flicker tracking-[0.05em]"
        onClick={() => navigate("/dashboard")}
      >
        {t("Go to dashboard →")}
      </Button>
    </section>
  )
}
