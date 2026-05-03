import { useTranslation } from "react-i18next"
import { useForm, Controller } from "react-hook-form"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createCircleSchema,
  type CreateCircleInput,
} from "@base-dashboard/shared"
import { createCircleApi } from "@/lib/circles"
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

const EMPTY_DEFAULTS: CreateCircleInput = {
  slug: "",
  themeId: "",
  labels: { en: "", es: "" },
  aliases: { en: [], es: [] },
}

export function AddCircleDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
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
  } = useForm<CreateCircleInput>({
    resolver: standardSchemaResolver(createCircleSchema),
    defaultValues: EMPTY_DEFAULTS,
  })

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
    mutation.mutate(values)
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
                          {theme.label}
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
                  <Input
                    id="add-circle-aliases-en"
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
              <FieldLabel htmlFor="add-circle-aliases-es">
                {t("Spanish aliases")}
              </FieldLabel>
              <Controller
                name="aliases.es"
                control={control}
                render={({ field }) => (
                  <Input
                    id="add-circle-aliases-es"
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
              <FieldLabel htmlFor="add-circle-popularity">
                {t("Popularity")}
              </FieldLabel>
              <Input
                id="add-circle-popularity"
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
