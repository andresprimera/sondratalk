import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useForm, Controller } from "react-hook-form"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  updateCircleSchema,
  type UpdateCircleInput,
  type AdminCircle,
} from "@base-dashboard/shared"
import { updateCircleApi } from "@/lib/circles"
import { circleTypeOptions } from "@/lib/circle-types"
import { fetchAllThemesApi } from "@/lib/themes"
import {
  NO_THEME_SELECT_VALUE,
  themeSelectValueForUpdate,
} from "@/lib/circle-theme-select"
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
import { CommaSeparatedInput } from "@/components/comma-separated-input"
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
  circle: AdminCircle | null
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
    watch,
    formState: { errors },
    reset,
  } = useForm<UpdateCircleInput>({
    resolver: standardSchemaResolver(updateCircleSchema),
  })

  const isPrivate = watch("isPrivate")

  useEffect(() => {
    if (circle) {
      reset({
        slug: circle.slug,
        themeId: circle.themeId,
        type: circle.type,
        labels: { en: circle.labels.en, es: circle.labels.es },
        aliases: {
          en: circle.aliases?.en ?? [],
          es: circle.aliases?.es ?? [],
        },
        popularity: circle.popularity ?? 0,
        isPrivate: circle.isPrivate ?? false,
        // password left undefined — only send when the admin enters a new one
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
    // Only include password if the admin explicitly typed one; otherwise the
    // backend keeps the existing hash.
    const { password, ...rest } = values
    const payload: UpdateCircleInput = password ? { ...rest, password } : rest
    mutation.mutate(payload)
  }

  return (
    <Dialog open={circle !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Edit Circle")}</DialogTitle>
          <DialogDescription>
            {t("Edit circle properties.")}
          </DialogDescription>
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
                    items={[
                      { value: NO_THEME_SELECT_VALUE, label: t("No theme") },
                      ...themes.map((theme) => ({
                        value: theme.id,
                        label: theme.labels[locale],
                      })),
                    ]}
                    value={field.value || NO_THEME_SELECT_VALUE}
                    onValueChange={(val) => {
                      if (!val) return
                      field.onChange(themeSelectValueForUpdate(val))
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("Select a theme")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_THEME_SELECT_VALUE}>
                        {t("No theme")}
                      </SelectItem>
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
              <FieldLabel>{t("Type")}</FieldLabel>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select
                    items={circleTypeOptions.map((opt) => ({
                      value: opt.value,
                      label: t(opt.label),
                    }))}
                    value={field.value ?? ""}
                    onValueChange={(val) => {
                      if (val) field.onChange(val)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("Select a type")} />
                    </SelectTrigger>
                    <SelectContent>
                      {circleTypeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {t(opt.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.type && (
                <FieldDescription className="text-destructive">
                  {t(errors.type.message ?? "")}
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel>{t("Private")}</FieldLabel>
              <Controller
                name="isPrivate"
                control={control}
                render={({ field }) => (
                  <Select
                    items={[
                      { value: "no", label: t("No") },
                      { value: "yes", label: t("Yes") },
                    ]}
                    value={field.value ? "yes" : "no"}
                    onValueChange={(val) => {
                      if (val) field.onChange(val === "yes")
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">{t("No")}</SelectItem>
                      <SelectItem value="yes">{t("Yes")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            {isPrivate && (
              <Field>
                <FieldLabel htmlFor="edit-circle-password">
                  {t("Password")}
                </FieldLabel>
                <PasswordInput
                  id="edit-circle-password"
                  {...register("password")}
                />
                <FieldDescription>
                  {t("Leave blank to keep the current password.")}
                </FieldDescription>
                {errors.password && (
                  <FieldDescription className="text-destructive">
                    {t(errors.password.message ?? "")}
                  </FieldDescription>
                )}
              </Field>
            )}
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
                  <CommaSeparatedInput
                    id="edit-circle-aliases-en"
                    value={field.value ?? []}
                    onChange={field.onChange}
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
                  <CommaSeparatedInput
                    id="edit-circle-aliases-es"
                    value={field.value ?? []}
                    onChange={field.onChange}
                  />
                )}
              />
              <FieldDescription>
                {t("Comma-separated alternative names.")}
              </FieldDescription>
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
