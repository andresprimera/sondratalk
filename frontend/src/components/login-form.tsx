import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
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
import { PasswordInput } from "@/components/ui/password-input"
import { useForm } from "react-hook-form"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { loginSchema, type LoginInput } from "@base-dashboard/shared"
import { useAuth } from "@/hooks/use-auth"
import { useNavigate, Link } from "react-router"
import { useState } from "react"
import { toast } from "sonner"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: standardSchemaResolver(loginSchema),
  })

  async function onSubmit(values: LoginInput) {
    setIsSubmitting(true)
    try {
      await login(values.email, values.password)
      navigate("/dashboard")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Login failed"))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>{t("Login to your account")}</CardTitle>
          <CardDescription>
            {t("Enter your email below to login to your account")}
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
                    {errors.email.message}
                  </FieldDescription>
                )}
              </Field>
              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="password">{t("Password")}</FieldLabel>
                  <Link
                    to="/forgot-password"
                    className="text-sm underline underline-offset-4"
                  >
                    {t("Forgot password?")}
                  </Link>
                </div>
                <PasswordInput
                  id="password"
                  {...register("password")}
                />
                {errors.password && (
                  <FieldDescription className="text-destructive">
                    {errors.password.message}
                  </FieldDescription>
                )}
              </Field>
              <Field>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? t("Logging in...") : t("Login")}
                </Button>
                <FieldDescription className="text-center">
                  {t("Don't have an account?")}{" "}
                  <Link to="/signup" className="underline underline-offset-4">
                    {t("Sign up")}
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
