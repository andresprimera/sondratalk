import { useTranslation } from "react-i18next"
import { useForm } from "react-hook-form"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  createAllowlistEntrySchema,
  type CreateAllowlistEntryInput,
} from "@base-dashboard/shared"
import { createAllowlistEntryApi } from "@/lib/allowlist"
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
import { Button } from "@/components/ui/button"

export function AddAllowlistDialog({
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
    formState: { errors },
    reset,
  } = useForm<CreateAllowlistEntryInput>({
    resolver: standardSchemaResolver(createAllowlistEntrySchema),
  })

  const mutation = useMutation({
    mutationFn: createAllowlistEntryApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allowlist"] })
      toast.success(t("Entry added"))
      onOpenChange(false)
      reset()
    },
    onError: (error: Error) => {
      toast.error(t(error.message) || t("Failed to add entry"))
    },
  })

  function onSubmit(values: CreateAllowlistEntryInput) {
    mutation.mutate(values)
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
          <DialogTitle>{t("Add to early access")}</DialogTitle>
          <DialogDescription>
            {t("Allow an email address or a whole domain to sign up.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="add-allowlist-value">
                {t("Email or domain")}
              </FieldLabel>
              <Input
                id="add-allowlist-value"
                type="text"
                placeholder="person@example.com"
                {...register("value")}
              />
              <FieldDescription>
                {t("An email (person@example.com) or a domain (@example.com)")}
              </FieldDescription>
              {errors.value && (
                <FieldDescription className="text-destructive">
                  {t(errors.value.message ?? "")}
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="add-allowlist-note">
                {t("Note (optional)")}
              </FieldLabel>
              <Input
                id="add-allowlist-note"
                type="text"
                placeholder={t("Who is this for?")}
                {...register("note")}
              />
              {errors.note && (
                <FieldDescription className="text-destructive">
                  {t(errors.note.message ?? "")}
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
              {mutation.isPending ? t("Adding...") : t("Add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
