import { useTranslation } from "react-i18next"
import { useForm } from "react-hook-form"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createThemeSchema, type CreateThemeInput } from "@base-dashboard/shared"
import { createThemeApi } from "@/lib/themes"
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

export function AddThemeDialog({
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
  } = useForm<CreateThemeInput>({
    resolver: standardSchemaResolver(createThemeSchema),
    defaultValues: { sortOrder: 0 },
  })

  const mutation = useMutation({
    mutationFn: createThemeApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["themes"] })
      toast.success(t("Theme created"))
      onOpenChange(false)
      reset({ sortOrder: 0 })
    },
    onError: (error: Error) => {
      toast.error(t(error.message) || t("Failed to create theme"))
    },
  })

  function onSubmit(values: CreateThemeInput) {
    mutation.mutate(values)
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      reset({ sortOrder: 0 })
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Add Theme")}</DialogTitle>
          <DialogDescription>
            {t("Create a new umbrella category for circles.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="add-theme-slug">{t("Slug")}</FieldLabel>
              <Input
                id="add-theme-slug"
                type="text"
                placeholder="dogs"
                {...register("slug")}
              />
              <FieldDescription>
                {t("Lowercase, kebab-case (e.g. dogs, sports-cars)")}
              </FieldDescription>
              {errors.slug && (
                <FieldDescription className="text-destructive">
                  {t(errors.slug.message ?? "")}
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="add-theme-label">{t("Label")}</FieldLabel>
              <Input
                id="add-theme-label"
                type="text"
                placeholder="Dogs"
                {...register("label")}
              />
              {errors.label && (
                <FieldDescription className="text-destructive">
                  {t(errors.label.message ?? "")}
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="add-theme-sort">
                {t("Sort Order")}
              </FieldLabel>
              <Input
                id="add-theme-sort"
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
              onClick={() => handleOpenChange(false)}
            >
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t("Creating...") : t("Create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
