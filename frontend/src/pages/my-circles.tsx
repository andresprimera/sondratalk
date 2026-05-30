import { useEffect, useState } from "react"
import { Link } from "react-router"
import { useTranslation } from "react-i18next"
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"
import {
  AlertCircleIcon,
  ChevronLeft,
  Loader2,
  X,
} from "lucide-react"
import type { Circle } from "@base-dashboard/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchCirclesApi } from "@/lib/circles"
import {
  fetchMyCirclesApi,
  updateMyCirclesApi,
} from "@/lib/memberships"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 24
const SKELETON_WIDTHS = ["w-16", "w-20", "w-24", "w-28"] as const
const myCirclesKey = ["users", "me", "circles"] as const

export default function MyCirclesPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const locale: "en" | "es" =
    i18n.language?.split("-")[0] === "es" ? "es" : "en"

  const myCirclesQuery = useQuery({
    queryKey: myCirclesKey,
    queryFn: fetchMyCirclesApi,
  })

  const [draft, setDraft] = useState<Circle[]>([])
  const [seeded, setSeeded] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")

  useEffect(() => {
    if (!seeded && myCirclesQuery.data) {
      setDraft(myCirclesQuery.data)
      setSeeded(true)
    }
  }, [seeded, myCirclesQuery.data])

  useEffect(() => {
    const trimmed = searchValue.trim()
    const next = trimmed.length >= 3 ? trimmed : ""
    const id = setTimeout(() => setDebouncedQ(next), 250)
    return () => clearTimeout(id)
  }, [searchValue])

  const catalog = useInfiniteQuery({
    queryKey: ["circles-picker", { q: debouncedQ, locale, pageSize: PAGE_SIZE }] as const,
    queryFn: ({ pageParam }) =>
      fetchCirclesApi({
        q: debouncedQ || undefined,
        locale,
        page: pageParam,
        limit: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages
        ? lastPage.meta.page + 1
        : undefined,
    placeholderData: keepPreviousData,
  })

  const fetchedCircles: Circle[] =
    catalog.data?.pages.flatMap((p) => p.data) ?? []

  const saveMutation = useMutation({
    mutationFn: updateMyCirclesApi,
    onSuccess: (data) => {
      queryClient.setQueryData<Circle[]>(myCirclesKey, data)
      setDraft(data)
      toast.success(t("Saved"))
    },
    onError: () => {
      toast.error(t("Failed to save your circles"))
    },
  })

  function add(circle: Circle) {
    setDraft((prev) =>
      prev.some((c) => c.id === circle.id) ? prev : [...prev, circle],
    )
  }

  function remove(id: string) {
    setDraft((prev) => prev.filter((c) => c.id !== id))
  }

  function handleSave() {
    saveMutation.mutate({ circleIds: draft.map((c) => c.id) })
  }

  const draftIds = draft.map((c) => c.id)
  const savedIds = (myCirclesQuery.data ?? []).map((c) => c.id)
  const isDirty =
    draftIds.length !== savedIds.length ||
    draftIds.some((id, i) => id !== savedIds[i])

  const tooMany = draft.length > 50
  const empty = draft.length === 0
  const saveDisabled =
    saveMutation.isPending ||
    myCirclesQuery.isLoading ||
    !isDirty ||
    empty ||
    tooMany

  return (
    <div className="mx-auto w-full max-w-2xl py-8">
      <Button
        variant="ghost"
        size="sm"
        className="mb-6 -ml-2"
        render={<Link to="/dashboard" />}
      >
        <ChevronLeft /> {t("Dashboard")}
      </Button>

      <div className="mb-2 text-[0.6875rem] tracking-widest text-primary/80 uppercase">
        {t("Your Circles")}
      </div>
      <h1 className="mb-2">{t("My Circles")}</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        {t("The communities, backgrounds, and passions that shape you.")}
      </p>

      <div className="mb-3 text-[0.6875rem] tracking-widest text-muted-foreground/60 uppercase">
        {t("Currently selected")}
      </div>
      <Card>
        <CardContent>
          {myCirclesQuery.isLoading ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-20 rounded-full" />
              ))}
            </div>
          ) : myCirclesQuery.isError ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <AlertCircleIcon className="size-4 text-destructive" />
              <span>{t("Failed to load circles.")}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => myCirclesQuery.refetch()}
              >
                {t("Try again")}
              </Button>
            </div>
          ) : draft.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("You haven't picked any circles yet.")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {draft.map((c) => (
                <Badge
                  key={c.id}
                  variant="secondary"
                  className="gap-1 pr-1"
                >
                  {c.labels[locale]}
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    aria-label={t("Remove {{circle}}", {
                      circle: c.labels[locale],
                    })}
                    className="ml-1 inline-flex size-4 items-center justify-center rounded-full hover:bg-foreground/10"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator className="my-8" />

      <div className="mb-3 text-[0.6875rem] tracking-widest text-muted-foreground/60 uppercase">
        {t("Add more")}
      </div>
      <Input
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        placeholder={t("Search circles...")}
        className="mb-4"
      />

      {catalog.isLoading ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn(
                "h-7 rounded-full",
                SKELETON_WIDTHS[i % SKELETON_WIDTHS.length],
              )}
            />
          ))}
        </div>
      ) : catalog.isError ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <AlertCircleIcon className="size-4 text-destructive" />
          <span>{t("Failed to load circles.")}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => catalog.refetch()}
          >
            {t("Try again")}
          </Button>
        </div>
      ) : fetchedCircles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("No circles match your search.")}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {fetchedCircles.map((c) => {
              const used = draft.some((sel) => sel.id === c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => (used ? remove(c.id) : add(c))}
                  aria-pressed={used}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    used
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c.labels[locale]}
                </button>
              )
            })}
          </div>
          {catalog.hasNextPage && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => catalog.fetchNextPage()}
                disabled={catalog.isFetchingNextPage}
              >
                {catalog.isFetchingNextPage && (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                )}
                {t("Load more")}
              </Button>
            </div>
          )}
        </>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <Button onClick={handleSave} disabled={saveDisabled}>
          {saveMutation.isPending ? t("Saving...") : t("Save circles")}
        </Button>
        {tooMany ? (
          <span className="text-sm text-destructive">
            {t("Too many circles selected")}
          </span>
        ) : empty ? (
          <span className="text-sm text-muted-foreground">
            {t("Pick at least one circle")}
          </span>
        ) : (
          !isDirty && (
            <span className="text-sm text-muted-foreground">
              {t("Changes apply within a few minutes.")}
            </span>
          )
        )}
      </div>
    </div>
  )
}
