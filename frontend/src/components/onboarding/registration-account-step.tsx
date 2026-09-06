import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useForm } from "react-hook-form"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { signupSchema } from "@base-dashboard/shared"
import { z } from "zod/v4"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

const accountSchema = signupSchema.omit({ timezone: true })
export type RegistrationAccountValues = z.infer<typeof accountSchema>

interface RegistrationAccountStepProps {
  onSubmit: (values: RegistrationAccountValues) => Promise<void>
  onBack: () => void
}

export function RegistrationAccountStep({
  onSubmit,
  onBack,
}: RegistrationAccountStepProps) {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegistrationAccountValues>({
    resolver: standardSchemaResolver(accountSchema),
  })

  async function submit(values: RegistrationAccountValues) {
    setIsSubmitting(true)
    try {
      await onSubmit(values)
    } catch (error) {
      toast.error(
        error instanceof Error ? t(error.message) : t("Signup failed"),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="mt-10 max-w-xl">
      <button type="button" className="onboarding-back mb-8" onClick={onBack}>
        <span className="inline-flex items-center gap-1">
          <ArrowLeft className="size-3.5" /> {t("Back")}
        </span>
      </button>
      <p className="onboarding-eyebrow mb-6">{t("One last thing")}</p>
      <h1 className="onboarding-step-heading mb-4">
        {t("Where should we reach you?")}
      </h1>
      <p className="onboarding-step-subline mb-8">
        {t(
          "So you have access to your dashboard and we can tell you when there's someone on the other side.",
        )}
      </p>

      <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-3">
        <div>
          <input
            type="text"
            className="onboarding-field"
            placeholder={t("Your name")}
            autoComplete="name"
            {...register("name")}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-destructive">
              {t(errors.name.message ?? "")}
            </p>
          )}
        </div>
        <div>
          <input
            type="email"
            className="onboarding-field"
            placeholder={t("Email address")}
            autoComplete="email"
            {...register("email")}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-destructive">
              {t(errors.email.message ?? "")}
            </p>
          )}
        </div>
        <div>
          <input
            type="password"
            className="onboarding-field"
            placeholder={t("Choose a password")}
            autoComplete="new-password"
            {...register("password")}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-destructive">
              {t(errors.password.message ?? "")}
            </p>
          )}
        </div>

        <div className="mt-5">
          <Button
            type="submit"
            size="xl"
            className="landing-flicker tracking-[0.05em]"
            disabled={isSubmitting}
          >
            {isSubmitting ? t("Creating your account...") : t("Enter Sondra")}
          </Button>
        </div>
        <p className="mt-4 text-sm font-light text-muted-foreground/60">
          {t("Free while Sondra is in beta. No card, nothing to cancel.")}
        </p>
      </form>
    </section>
  )
}
