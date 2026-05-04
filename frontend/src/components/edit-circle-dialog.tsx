import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useForm, Controller } from "react-hook-form"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  updateCircleSchema,
  type UpdateCircleInput,
  type Circle,
} from "@base-dashboard/shared"
import { updateCircleApi } from "@/lib/circles"
import { fetchAllThemesApi } from "@/lib/themes"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function EditCircleDialog({
  circle,
  onOpenChange,
}: {
  circle: Circle | null
  onOpenChange: (open: boolean) => void
}) {
  const { t, i18n } = useTranslation()
  const locale: "en" | "es" =
    i18n.language?.split("-")[0] === "es" ? "es" : "en"
  const queryClient = useQueryClient()

  const { data: themes = [] } = useQuery({
    queryKey: ["themes", "all"],
    queryFn: fetchAllThemesApi,
  })

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<UpdateCircleInput>({
    resolver: standardSchemaResolver(updateCircleSchema),
  })

  useEffect(() => {
    if (circle) {
      reset({
        slug: circle.slug,
        themeId: circle.themeId,
        labels: { en: circle.labels.en, es: circle.labels.es },
        aliases: { en: circle.aliases.en, es: circle.aliases.es },
        popularity: circle.popularity,
      })
    }
  }, [circle, reset])

  const mutation = useMutation({
    mutationFn: (values: UpdateCircleInput) => {
      if (!circle) throw new Error("No circle selected")
      return updateCircleApi(circle.id, values)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circles"] })
      toast.success(t("Circle updated"))
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error(t(error.message) || t("Failed to update circle"))
    },
  })

  function onSubmit(values: UpdateCircleInput) {
    mutation.mutate(values)
  }

  return (
    <Dialog open={circle !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Edit Circle")}</DialogTitle>
          <DialogDescription>{t("Update circle details.")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit-circle-slug">{t("Slug")}</FieldLabel>
              <Input
                id="edit-circle-slug"
                type="text"
                disabled
                {...register("slug")}
              />
              <FieldDescription>
                {t("Slug cannot be changed after creation.")}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel>{t("Theme")}</FieldLabel>
              <Controller
                name="themeId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || ""}
                    onValueChange={(val) => {
                      if (val) field.onChange(val)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("Select a theme")} />
                    </SelectTrigger>
                    <SelectContent>
                      {themes.map((theme) => (
                        <SelectItem key={theme.id} value={theme.id}>
                          {theme.labels[locale]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.themeId && (
                <FieldDescription className="text-destructive">
                  {t(errors.themeId.message ?? "")}
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-circle-label-en">
                {t("English label")}
              </FieldLabel>
              <Input
                id="edit-circle-label-en"
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
              <FieldLabel htmlFor="edit-circle-label-es">
                {t("Spanish label")}
              </FieldLabel>
              <Input
                id="edit-circle-label-es"
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
              <FieldLabel htmlFor="edit-circle-aliases-en">
                {t("English aliases")}
              </FieldLabel>
              <Controller
                name="aliases.en"
                control={control}
                render={({ field }) => (
                  <Input
                    id="edit-circle-aliases-en"
                    type="text"
                    value={(field.value ?? []).join(", ")}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      )
                    }
                  />
                )}
              />
              <FieldDescription>
                {t("Comma-separated alternative names.")}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-circle-aliases-es">
                {t("Spanish aliases")}
              </FieldLabel>
              <Controller
                name="aliases.es"
                control={control}
                render={({ field }) => (
                  <Input
                    id="edit-circle-aliases-es"
                    type="text"
                    value={(field.value ?? []).join(", ")}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      )
                    }
                  />
                )}
              />
              <FieldDescription>
                {t("Comma-separated alternative names.")}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-circle-popularity">
                {t("Popularity")}
              </FieldLabel>
              <Input
                id="edit-circle-popularity"
                type="number"
                min={0}
                {...register("popularity", { valueAsNumber: true })}
              />
              {errors.popularity && (
                <FieldDescription className="text-destructive">
                  {t(errors.popularity.message ?? "")}
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
