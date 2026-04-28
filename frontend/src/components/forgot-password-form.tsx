import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useForm } from "react-hook-form"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { forgotPasswordSchema, type ForgotPasswordInput } from "@base-dashboard/shared"
import { forgotPasswordApi } from "@/lib/auth"
import { Link } from "react-router"
import { useState } from "react"
import { toast } from "sonner"

export function ForgotPasswordForm({
  ...props
}: React.ComponentProps<typeof Card>) {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: standardSchemaResolver(forgotPasswordSchema),
  })

  async function onSubmit(values: ForgotPasswordInput) {
    setIsSubmitting(true)
    try {
      await forgotPasswordApi(values.email)
      setIsSubmitted(true)
    } catch (error) {
      toast.error(
        error instanceof Error ? t(error.message) : t("Something went wrong"),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <Card {...props}>
        <CardHeader>
          <CardTitle>{t("Check your email")}</CardTitle>
          <CardDescription>
            {t("If an account with that email exists, we sent a password reset link. Please check your inbox.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldDescription className="text-center">
                <Link
                  to="/login"
                  className="underline underline-offset-4"
                >
                  {t("Back to login")}
                </Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>{t("Forgot your password?")}</CardTitle>
        <CardDescription>
          {t("Enter your email and we'll send you a reset link")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">{t("Email")}</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder={t("m@example.com")}
                {...register("email")}
              />
              {errors.email && (
                <FieldDescription className="text-destructive">
                  {t(errors.email.message ?? "")}
                </FieldDescription>
              )}
            </Field>
            <Field>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("Sending...") : t("Send reset link")}
              </Button>
              <FieldDescription className="text-center">
                {t("Remember your password?")}{" "}
                <Link
                  to="/login"
                  className="underline underline-offset-4"
                >
                  {t("Back to login")}
                </Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
