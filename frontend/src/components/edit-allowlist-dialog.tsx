import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useForm } from "react-hook-form"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  updateAllowlistEntrySchema,
  type UpdateAllowlistEntryInput,
  type AllowlistEntry,
} from "@base-dashboard/shared"
import { updateAllowlistEntryApi } from "@/lib/allowlist"
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

export function EditAllowlistDialog({
  entry,
  onOpenChange,
}: {
  entry: AllowlistEntry | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UpdateAllowlistEntryInput>({
    resolver: standardSchemaResolver(updateAllowlistEntrySchema),
  })

  useEffect(() => {
    if (entry) {
      reset({ value: entry.value, note: entry.note ?? undefined })
    }
  }, [entry, reset])

  const mutation = useMutation({
    mutationFn: (values: UpdateAllowlistEntryInput) => {
      if (!entry) throw new Error("No entry selected")
      return updateAllowlistEntryApi(entry.id, values)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allowlist"] })
      toast.success(t("Entry updated"))
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error(t(error.message) || t("Failed to update entry"))
    },
  })

  function onSubmit(values: UpdateAllowlistEntryInput) {
    mutation.mutate(values)
  }

  return (
    <Dialog open={entry !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Edit early access entry")}</DialogTitle>
          <DialogDescription>
            {t("Update the email/domain or its note.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit-allowlist-value">
                {t("Email or domain")}
              </FieldLabel>
              <Input
                id="edit-allowlist-value"
                type="text"
                {...register("value")}
              />
              {errors.value && (
                <FieldDescription className="text-destructive">
                  {t(errors.value.message ?? "")}
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-allowlist-note">
                {t("Note (optional)")}
              </FieldLabel>
              <Input
                id="edit-allowlist-note"
                type="text"
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
              onClick={() => onOpenChange(false)}
            >
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t("Saving...") : t("Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
