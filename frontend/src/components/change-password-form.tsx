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
import { useTranslation } from "react-i18next"
import { useForm } from "react-hook-form"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { changePasswordSchema } from "@base-dashboard/shared"
import { z } from "zod/v4"
import { useState } from "react"
import { toast } from "sonner"
import { changePasswordApi } from "@/lib/profile"

const changePasswordFormSchema = changePasswordSchema
  .extend({
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>

export function ChangePasswordForm() {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: standardSchemaResolver(changePasswordFormSchema),
  })

  async function onSubmit(values: ChangePasswordFormValues) {
    setIsSubmitting(true)
    try {
      await changePasswordApi(values.currentPassword, values.newPassword)
      toast.success(t("Password changed successfully"))
      reset()
    } catch (error) {
      toast.error(
        error instanceof Error ? t(error.message) : t("Failed to change password"),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("Change Password")}</CardTitle>
        <CardDescription>
          {t("Update your password to keep your account secure")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="currentPassword">
                {t("Current Password")}
              </FieldLabel>
              <PasswordInput
                id="currentPassword"
                {...register("currentPassword")}
              />
              {errors.currentPassword && (
                <FieldDescription className="text-destructive">
                  {t(errors.currentPassword.message ?? "")}
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="newPassword">{t("New Password")}</FieldLabel>
              <PasswordInput
                id="newPassword"
                {...register("newPassword")}
              />
              {errors.newPassword && (
                <FieldDescription className="text-destructive">
                  {t(errors.newPassword.message ?? "")}
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="confirmPassword">
                {t("Confirm New Password")}
              </FieldLabel>
              <PasswordInput
                id="confirmPassword"
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
                {isSubmitting ? t("Changing...") : t("Change Password")}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
