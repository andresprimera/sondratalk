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
import { useTranslation } from "react-i18next"
import { useForm } from "react-hook-form"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { updateProfileSchema, type UpdateProfileInput } from "@base-dashboard/shared"
import { useAuth } from "@/hooks/use-auth"
import { useState } from "react"
import { toast } from "sonner"
import { updateProfileApi } from "@/lib/profile"

export function ProfileForm() {
  const { t } = useTranslation()
  const { user, updateUser } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateProfileInput>({
    resolver: standardSchemaResolver(updateProfileSchema),
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
    },
  })

  async function onSubmit(values: UpdateProfileInput) {
    setIsSubmitting(true)
    try {
      const updatedUser = await updateProfileApi(values.name, values.email)
      updateUser(updatedUser)
      toast.success(t("Profile updated successfully"))
    } catch (error) {
      toast.error(
        error instanceof Error ? t(error.message) : t("Failed to update profile"),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("Profile Information")}</CardTitle>
        <CardDescription>{t("Update your name and email address")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">{t("Name")}</FieldLabel>
              <Input id="name" type="text" {...register("name")} />
              {errors.name && (
                <FieldDescription className="text-destructive">
                  {t(errors.name.message ?? "")}
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="email">{t("Email")}</FieldLabel>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && (
                <FieldDescription className="text-destructive">
                  {t(errors.email.message ?? "")}
                </FieldDescription>
              )}
            </Field>
            <Field>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("Saving...") : t("Save Changes")}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
