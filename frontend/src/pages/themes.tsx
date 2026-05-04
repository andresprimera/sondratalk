import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query"
import { fetchThemesApi, removeThemeApi } from "@/lib/themes"
import type { Theme } from "@base-dashboard/shared"
import { AddThemeDialog } from "@/components/add-theme-dialog"
import { EditThemeDialog } from "@/components/edit-theme-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertCircleIcon,
  TrashIcon,
  PencilIcon,
  ChevronsLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsRightIcon,
  PlusIcon,
  LayersIcon,
} from "lucide-react"
import { toast } from "sonner"

export default function ThemesPage() {
  const { t, i18n } = useTranslation()
  const locale: "en" | "es" =
    i18n.language?.split("-")[0] === "es" ? "es" : "en"
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [addOpen, setAddOpen] = useState(false)
  const [editTheme, setEditTheme] = useState<Theme | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["themes", page, pageSize],
    queryFn: () => fetchThemesApi(page, pageSize),
    placeholderData: keepPreviousData,
  })

  const themes = data?.data ?? []
  const meta = data?.meta
  const totalPages = meta?.totalPages ?? 1

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeThemeApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["themes"] })
      toast.success(t("Theme deleted"))
    },
    onError: (error: Error) => {
      toast.error(t(error.message) || t("Failed to delete theme"))
    },
  })

  function handleDelete() {
    if (!deleteId) return
    deleteMutation.mutate(deleteId, {
      onSettled: () => setDeleteId(null),
    })
  }

  function handlePageSizeChange(value: string | null) {
    if (!value) return
    setPageSize(Number(value))
    setPage(1)
  }

  const Header = (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("Themes")}</h2>
        <p className="text-muted-foreground">
          {t("Manage circle umbrella categories.")}
        </p>
      </div>
      <Button onClick={() => setAddOpen(true)}>
        <PlusIcon className="size-4" />
        {t("Add Theme")}
      </Button>
    </div>
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Header}
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Slug")}</TableHead>
                <TableHead>{t("Label")}</TableHead>
                <TableHead>{t("Sort Order")}</TableHead>
                <TableHead className="w-25">{t("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: pageSize > 5 ? 5 : pageSize }).map(
                (_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-8" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="size-8" />
                    </TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-4">
        {Header}
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <AlertCircleIcon className="size-10 text-destructive" />
          <p className="text-muted-foreground">
            {t(error.message) || t("Failed to load themes.")}
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            {t("Try again")}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {Header}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Slug")}</TableHead>
              <TableHead>{t("Label")}</TableHead>
              <TableHead>{t("Sort Order")}</TableHead>
              <TableHead className="w-25">{t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {themes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <LayersIcon className="size-8" />
                    <p>{t("No themes found.")}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              themes.map((theme: Theme) => (
                <TableRow key={theme.id}>
                  <TableCell className="font-mono text-sm">
                    {theme.slug}
                  </TableCell>
                  <TableCell className="font-medium">
                    {theme.labels[locale]}
                  </TableCell>
                  <TableCell>{theme.sortOrder}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditTheme(theme)}
                      >
                        <PencilIcon className="size-4" />
                        <span className="sr-only">{t("Edit")}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(theme.id)}
                      >
                        <TrashIcon className="size-4" />
                        <span className="sr-only">{t("Delete")}</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {meta && (
        <div className="flex items-center justify-between px-4">
          <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            {t("{{count}} theme total", { count: meta.total })}
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                {t("Rows per page")}
              </Label>
              <Select
                value={String(pageSize)}
                onValueChange={handlePageSizeChange}
              >
                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                  <SelectValue placeholder={String(pageSize)} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 50].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              {t("Page {{page}} of {{totalPages}}", { page, totalPages })}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => setPage(1)}
                disabled={page <= 1}
              >
                <span className="sr-only">{t("Go to first page")}</span>
                <ChevronsLeftIcon />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <span className="sr-only">{t("Go to previous page")}</span>
                <ChevronLeftIcon />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <span className="sr-only">{t("Go to next page")}</span>
                <ChevronRightIcon />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
              >
                <span className="sr-only">{t("Go to last page")}</span>
                <ChevronsRightIcon />
              </Button>
            </div>
          </div>
        </div>
      )}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete theme")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t("Deleting...") : t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AddThemeDialog open={addOpen} onOpenChange={setAddOpen} />
      <EditThemeDialog
        theme={editTheme}
        onOpenChange={(open) => {
          if (!open) setEditTheme(null)
        }}
      />
    </div>
  )
}
