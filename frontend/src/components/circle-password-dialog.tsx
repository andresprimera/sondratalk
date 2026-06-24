import { useTranslation } from "react-i18next"
import { useForm } from "react-hook-form"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  verifyCirclePasswordSchema,
  type VerifyCirclePasswordInput,
} from "@base-dashboard/shared"
import { verifyCirclePasswordApi } from "@/lib/circles"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { PasswordInput } from "@/components/ui/password-input"
import { Button } from "@/components/ui/button"

interface CirclePasswordDialogProps {
  circle: { id: string; label: string } | null
  onOpenChange: (open: boolean) => void
  onVerified: () => void
}

export function CirclePasswordDialog({
  circle,
  onOpenChange,
  onVerified,
}: CirclePasswordDialogProps) {
  const { t } = useTranslation()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VerifyCirclePasswordInput>({
    resolver: standardSchemaResolver(verifyCirclePasswordSchema),
    defaultValues: { password: "" },
  })

  const mutation = useMutation({
    mutationFn: (values: VerifyCirclePasswordInput) =>
      verifyCirclePasswordApi(circle?.id ?? "", values.password),
    onSuccess: () => {
      reset()
      onVerified()
    },
    onError: (error: Error) => {
      toast.error(t(error.message) || t("Something went wrong"))
    },
  })

  function onSubmit(values: VerifyCirclePasswordInput) {
    mutation.mutate(values)
  }

  function handleOpenChange(open: boolean) {
    if (!open) reset()
    onOpenChange(open)
  }

  return (
    <Dialog open={circle !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("This circle is private")}</DialogTitle>
          <DialogDescription>
            {t("Enter the password to join {{circle}}.", {
              circle: circle?.label ?? "",
            })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Field>
            <FieldLabel htmlFor="circle-password">{t("Password")}</FieldLabel>
            <PasswordInput
              id="circle-password"
              autoFocus
              {...register("password")}
            />
            {errors.password && (
              <FieldDescription className="text-destructive">
                {t(errors.password.message ?? "")}
              </FieldDescription>
            )}
          </Field>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t("Checking…") : t("Join")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
