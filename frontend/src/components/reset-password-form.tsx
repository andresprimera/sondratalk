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
import { PasswordInput } from "@/components/ui/password-input"
import { useForm } from "react-hook-form"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { z } from "zod/v4"
import { resetPasswordApi } from "@/lib/auth"
import { useNavigate, useSearchParams, Link } from "react-router"
import { useState } from "react"
import { toast } from "sonner"

const resetFormSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

type ResetFormValues = z.infer<typeof resetFormSchema>

export function ResetPasswordForm({
  ...props
}: React.ComponentProps<typeof Card>) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")
  const email = searchParams.get("email")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormValues>({
    resolver: standardSchemaResolver(resetFormSchema),
  })

  if (!token || !email) {
    return (
      <Card {...props}>
        <CardHeader>
          <CardTitle>{t("Invalid reset link")}</CardTitle>
          <CardDescription>
            {t("This password reset link is invalid or has expired. Please request a new one.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <Button render={<Link to="/forgot-password" />}>
                {t("Request new link")}
              </Button>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
    )
  }

  async function onSubmit(values: ResetFormValues) {
    setIsSubmitting(true)
    try {
      await resetPasswordApi(token!, email!, values.password)
      toast.success(t("Password reset successfully"))
      navigate("/login")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? t(error.message)
          : t("Failed to reset password"),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>{t("Reset your password")}</CardTitle>
        <CardDescription>{t("Enter your new password below")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="password">{t("New Password")}</FieldLabel>
              <PasswordInput
                id="password"
                {...register("password")}
              />
              {errors.password && (
                <FieldDescription className="text-destructive">
                  {t(errors.password.message ?? "")}
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password">
                {t("Confirm Password")}
              </FieldLabel>
              <PasswordInput
                id="confirm-password"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <FieldDescription className="text-destructive">
                  {t(errors.confirmPassword.message ?? "")}
                </FieldDescription>
              )}
            </Field>
            <Field>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("Resetting...") : t("Reset password")}
              </Button>
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
        </form>
      </CardContent>
    </Card>
  )
}
