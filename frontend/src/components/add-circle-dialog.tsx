import { useTranslation } from "react-i18next"
import { useForm, Controller } from "react-hook-form"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createCircleSchema,
  type CreateCircleInput,
} from "@base-dashboard/shared"
import { createCircleApi } from "@/lib/circles"
import { circleTypeOptions } from "@/lib/circle-types"
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

const EMPTY_DEFAULTS: CreateCircleInput = {
  slug: "",
  themeId: "",
  type: "who-you-are",
  labels: { en: "", es: "" },
  aliases: { en: [], es: [] },
  isPrivate: false,
  password: "",
}

export function AddCircleDialog({
  open,
  onOpenChange,
}: {
  open: boolean
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
  } = useForm<CreateCircleInput>({
    resolver: standardSchemaResolver(createCircleSchema),
    defaultValues: EMPTY_DEFAULTS,
  })

  const isPrivate = watch("isPrivate")

  const mutation = useMutation({
    mutationFn: createCircleApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circles"] })
      toast.success(t("Circle created"))
      onOpenChange(false)
      reset(EMPTY_DEFAULTS)
    },
    onError: (error: Error) => {
      toast.error(t(error.message) || t("Failed to create circle"))
    },
  })

  function onSubmit(values: CreateCircleInput) {
    mutation.mutate({
      ...values,
      password: values.isPrivate ? values.password : undefined,
    })
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      reset(EMPTY_DEFAULTS)
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Add Circle")}</DialogTitle>
          <DialogDescription>
            {t("Create a new granular topic within a theme.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="add-circle-slug">{t("Slug")}</FieldLabel>
              <Input
                id="add-circle-slug"
                type="text"
                placeholder="german-shepherd"
                {...register("slug")}
              />
              <FieldDescription>
                {t("Lowercase, kebab-case (e.g. german-shepherd)")}
              </FieldDescription>
              {errors.slug && (
                <FieldDescription className="text-destructive">
                  {t(errors.slug.message ?? "")}
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel>{t("Theme")}</FieldLabel>
              <Controller
                name="themeId"
                control={control}
                render={({ field }) => (
                  <Select
                    items={themes.map((theme) => ({
                      value: theme.id,
                      label: theme.labels[locale],
                    }))}
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
                    value={field.value || ""}
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
                <FieldLabel htmlFor="add-circle-password">
                  {t("Password")}
                </FieldLabel>
                <PasswordInput
                  id="add-circle-password"
                  {...register("password")}
                />
                <FieldDescription>
                  {t("Members will need this password to join the circle.")}
                </FieldDescription>
                {errors.password && (
                  <FieldDescription className="text-destructive">
                    {t(errors.password.message ?? "")}
                  </FieldDescription>
                )}
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="add-circle-label-en">
                {t("English label")}
              </FieldLabel>
              <Input
                id="add-circle-label-en"
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
              <FieldLabel htmlFor="add-circle-label-es">
                {t("Spanish label")}
              </FieldLabel>
              <Input
                id="add-circle-label-es"
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
              <FieldLabel htmlFor="add-circle-aliases-en">
                {t("English aliases")}
              </FieldLabel>
              <Controller
                name="aliases.en"
                control={control}
                render={({ field }) => (
                  <CommaSeparatedInput
                    id="add-circle-aliases-en"
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
              <FieldLabel htmlFor="add-circle-aliases-es">
                {t("Spanish aliases")}
              </FieldLabel>
              <Controller
                name="aliases.es"
                control={control}
                render={({ field }) => (
                  <CommaSeparatedInput
                    id="add-circle-aliases-es"
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
