import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query"
import { fetchAdminCirclesApi, removeCircleApi } from "@/lib/circles"
import { circleTypeLabel } from "@/lib/circle-types"
import { fetchAllThemesApi } from "@/lib/themes"
import type { AdminCircle, CircleSortBy } from "@base-dashboard/shared"
import { AddCircleDialog } from "@/components/add-circle-dialog"
import { EditCircleDialog } from "@/components/edit-circle-dialog"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertCircleIcon,
  ChevronsLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsRightIcon,
  PlusIcon,
  CircleDotIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowUpDownIcon,
  PencilIcon,
  TrashIcon,
} from "lucide-react"
import { toast } from "sonner"

const ALL_THEMES_VALUE = "__all__"
const NO_THEME_VALUE = "__none__"

const COLUMNS: { col: CircleSortBy; label: string }[] = [
  { col: "slug", label: "Slug" },
  { col: "labelEn", label: "English label" },
  { col: "labelEs", label: "Spanish label" },
  { col: "theme", label: "Theme" },
  { col: "type", label: "Circle Type" },
  { col: "popularity", label: "Popularity" },
]

function SortIcon({
  col,
  sortBy,
  sortDir,
}: {
  col: CircleSortBy
  sortBy: CircleSortBy
  sortDir: "asc" | "desc"
}) {
  if (sortBy !== col) return <ArrowUpDownIcon className="ml-1 inline size-3 opacity-40" />
  return sortDir === "asc"
    ? <ArrowUpIcon className="ml-1 inline size-3" />
    : <ArrowDownIcon className="ml-1 inline size-3" />
}

export default function CirclesPage() {
  const { t, i18n } = useTranslation()
  const locale: "en" | "es" =
    i18n.language?.split("-")[0] === "es" ? "es" : "en"
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [themeId, setThemeId] = useState<string | undefined>(undefined)
  const [noTheme, setNoTheme] = useState(false)
  const [sortBy, setSortBy] = useState<CircleSortBy>("slug")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [addOpen, setAddOpen] = useState(false)
  const [editCircle, setEditCircle] = useState<AdminCircle | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q), 250)
    return () => clearTimeout(id)
  }, [q])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, themeId, noTheme])

  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: removeCircleApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circles"] })
      toast.success(t("Circle deleted"))
    },
    onError: (error: Error) => {
      toast.error(t(error.message) || t("Failed to delete circle"))
    },
  })

  function handleDelete() {
    if (!deleteId) return
    deleteMutation.mutate(deleteId, {
      onSettled: () => setDeleteId(null),
    })
  }

  const { data: allThemes = [] } = useQuery({
    queryKey: ["themes", "all"],
    queryFn: fetchAllThemesApi,
  })

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [
      "circles",
      { q: debouncedQ, themeId, noTheme, locale, page, pageSize, sortBy, sortDir },
    ] as const,
    queryFn: () =>
      fetchAdminCirclesApi({
        q: debouncedQ || undefined,
        themeId,
        noTheme,
        locale,
        page,
        limit: pageSize,
        sortBy,
        sortDir,
      }),
    placeholderData: keepPreviousData,
  })

  const circles = data?.data ?? []
  const meta = data?.meta
  const totalPages = meta?.totalPages ?? 1

  function handlePageSizeChange(value: string | null) {
    if (!value) return
    setPageSize(Number(value))
    setPage(1)
  }

  function handleThemeFilterChange(value: string | null) {
    if (!value) return
    if (value === NO_THEME_VALUE) {
      setThemeId(undefined)
      setNoTheme(true)
      return
    }
    setThemeId(value === ALL_THEMES_VALUE ? undefined : value)
    setNoTheme(false)
  }

  function handleSort(col: CircleSortBy) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(col)
      setSortDir("asc")
    }
    setPage(1)
  }

  const Header = (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("Circles")}</h2>
        <p className="text-muted-foreground">
          {t("Manage granular circle topics within themes.")}
        </p>
      </div>
      <Button onClick={() => setAddOpen(true)}>
        <PlusIcon className="size-4" />
        {t("Add Circle")}
      </Button>
    </div>
  )

  const Filters = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Input
        type="search"
        placeholder={t("Search circles...")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="sm:max-w-sm"
      />
      <Select
        items={[
          { value: ALL_THEMES_VALUE, label: t("All themes") },
          { value: NO_THEME_VALUE, label: t("No theme") },
          ...allThemes.map((theme) => ({
            value: theme.id,
            label: theme.labels[locale],
          })),
        ]}
        value={noTheme ? NO_THEME_VALUE : (themeId ?? ALL_THEMES_VALUE)}
        onValueChange={handleThemeFilterChange}
      >
        <SelectTrigger className="sm:w-56">
          <SelectValue placeholder={t("All themes")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_THEMES_VALUE}>{t("All themes")}</SelectItem>
          <SelectItem value={NO_THEME_VALUE}>{t("No theme")}</SelectItem>
          {allThemes.map((theme) => (
            <SelectItem key={theme.id} value={theme.id}>
              {theme.labels[locale]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Header}
        {Filters}
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Slug")}</TableHead>
                <TableHead>{t("English label")}</TableHead>
                <TableHead>{t("Spanish label")}</TableHead>
                <TableHead>{t("Theme")}</TableHead>
                <TableHead>{t("Circle Type")}</TableHead>
                <TableHead>{t("Popularity")}</TableHead>
                <TableHead className="w-25">{t("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: pageSize > 5 ? 5 : pageSize }).map(
                (_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
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
        {Filters}
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <AlertCircleIcon className="size-10 text-destructive" />
          <p className="text-muted-foreground">
            {t(error.message) || t("Failed to load circles.")}
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            {t("Try again")}
          </Button>
        </div>
      </div>
    )
  }

  const isFiltered = Boolean(debouncedQ) || Boolean(themeId) || noTheme

  return (
    <div className="space-y-4">
      {Header}
      {Filters}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map(({ col, label }) => (
                <TableHead
                  key={col}
                  className="cursor-pointer select-none"
                  onClick={() => handleSort(col)}
                >
                  {t(label)}
                  <SortIcon col={col} sortBy={sortBy} sortDir={sortDir} />
                </TableHead>
              ))}
              <TableHead className="w-25">{t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {circles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS.length + 1} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <CircleDotIcon className="size-8" />
                    <p>
                      {isFiltered
                        ? t("No circles match your search.")
                        : t("No circles found.")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              circles.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-sm">{c.slug}</TableCell>
                  <TableCell className="font-medium">{c.labels.en}</TableCell>
                  <TableCell>{c.labels.es}</TableCell>
                  <TableCell>
                    {c.themeId
                      ? (allThemes.find((th) => th.id === c.themeId)?.labels[
                          locale
                        ] ?? c.themeId)
                      : t("No theme")}
                  </TableCell>
                  <TableCell>{t(circleTypeLabel(c.type))}</TableCell>
                  <TableCell>{c.membershipCount}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditCircle(c)}
                      >
                        <PencilIcon className="size-4" />
                        <span className="sr-only">{t("Edit")}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(c.id)}
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
            {t("{{count}} circle total", { count: meta.total })}
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
      <AddCircleDialog open={addOpen} onOpenChange={setAddOpen} />
      <EditCircleDialog
        circle={editCircle}
        onOpenChange={(open) => { if (!open) setEditCircle(null) }}
      />
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete circle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("This action cannot be undone. All memberships in this circle will be removed.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {deleteMutation.isPending ? t("Deleting...") : t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
