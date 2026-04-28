import { useTranslation } from "react-i18next"
import { useForm, Controller } from "react-hook-form"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createUserSchema } from "@base-dashboard/shared"
import { z } from "zod/v4"
import { createUserApi } from "@/lib/users"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"

const addUserFormSchema = createUserSchema
  .extend({ confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

type AddUserValues = z.infer<typeof addUserFormSchema>

export function AddUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<AddUserValues>({
    resolver: standardSchemaResolver(addUserFormSchema),
    defaultValues: {
      role: "user",
    },
  })

  const mutation = useMutation({
    mutationFn: createUserApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      toast.success(t("User created"))
      onOpenChange(false)
      reset()
    },
    onError: (error: Error) => {
      toast.error(error.message || t("Failed to create user"))
    },
  })

  function onSubmit(values: AddUserValues) {
    mutation.mutate({
      name: values.name,
      email: values.email,
      password: values.password,
      role: values.role,
    })
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      reset()
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Add User")}</DialogTitle>
          <DialogDescription>
            {t("Create a new user account")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="add-user-name">
                {t("Full Name")}
              </FieldLabel>
              <Input
                id="add-user-name"
                type="text"
                placeholder={t("John Doe")}
                {...register("name")}
              />
              {errors.name && (
                <FieldDescription className="text-destructive">
                  {errors.name.message}
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="add-user-email">{t("Email")}</FieldLabel>
              <Input
                id="add-user-email"
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
              <FieldLabel htmlFor="add-user-password">
                {t("Password")}
              </FieldLabel>
              <PasswordInput
                id="add-user-password"
                {...register("password")}
              />
              {errors.password && (
                <FieldDescription className="text-destructive">
                  {errors.password.message}
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="add-user-confirm-password">
                {t("Confirm Password")}
              </FieldLabel>
              <PasswordInput
                id="add-user-confirm-password"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <FieldDescription className="text-destructive">
                  {errors.confirmPassword.message}
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel>{t("Role")}</FieldLabel>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val) => {
                      if (val) field.onChange(val)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">{t("User")}</SelectItem>
                      <SelectItem value="admin">{t("Admin")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.role && (
                <FieldDescription className="text-destructive">
                  {errors.role.message}
                </FieldDescription>
              )}
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t("Creating...") : t("Create User")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
