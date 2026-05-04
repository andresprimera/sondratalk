import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useForm } from "react-hook-form"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  updateThemeSchema,
  type UpdateThemeInput,
  type Theme,
} from "@base-dashboard/shared"
import { updateThemeApi } from "@/lib/themes"
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

export function EditThemeDialog({
  theme,
  onOpenChange,
}: {
  theme: Theme | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UpdateThemeInput>({
    resolver: standardSchemaResolver(updateThemeSchema),
  })

  useEffect(() => {
    if (theme) {
      reset({
        slug: theme.slug,
        labels: { en: theme.labels.en, es: theme.labels.es },
        sortOrder: theme.sortOrder,
      })
    }
  }, [theme, reset])

  const mutation = useMutation({
    mutationFn: (values: UpdateThemeInput) => {
      if (!theme) throw new Error("No theme selected")
      return updateThemeApi(theme.id, values)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["themes"] })
      toast.success(t("Theme updated"))
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error(t(error.message) || t("Failed to update theme"))
    },
  })

  function onSubmit(values: UpdateThemeInput) {
    mutation.mutate(values)
  }

  return (
    <Dialog open={theme !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Edit Theme")}</DialogTitle>
          <DialogDescription>
            {t("Update theme details.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit-theme-slug">{t("Slug")}</FieldLabel>
              <Input
                id="edit-theme-slug"
                type="text"
                disabled
                {...register("slug")}
              />
              <FieldDescription>
                {t("Slug cannot be changed after creation.")}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-theme-label-en">
                {t("English label")}
              </FieldLabel>
              <Input
                id="edit-theme-label-en"
                type="text"
                {...register("labels.en")}
              />
              {errors.labels?.en && (
                <FieldDescription className="text-destructive">
                  {t(errors.labels.en.message ?? "")}
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-theme-label-es">
                {t("Spanish label")}
              </FieldLabel>
              <Input
                id="edit-theme-label-es"
                type="text"
                {...register("labels.es")}
              />
              {errors.labels?.es && (
                <FieldDescription className="text-destructive">
                  {t(errors.labels.es.message ?? "")}
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-theme-sort">
                {t("Sort Order")}
              </FieldLabel>
              <Input
                id="edit-theme-sort"
                type="number"
                min={0}
                {...register("sortOrder", { valueAsNumber: true })}
              />
              {errors.sortOrder && (
                <FieldDescription className="text-destructive">
                  {t(errors.sortOrder.message ?? "")}
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
