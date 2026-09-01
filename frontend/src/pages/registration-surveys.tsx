import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { fetchRegistrationSurveysApi } from "@/lib/registration-surveys"
import type { AdminRegistrationSurvey } from "@base-dashboard/shared"
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
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertCircleIcon,
  ChevronsLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsRightIcon,
} from "lucide-react"
import i18n from "@/lib/i18n"

const INTENT_LABELS: Record<string, string> = {
  curiosity: "Curiosity",
  deeper: "Something deeper",
  "new-city": "A new city",
  "other-lives": "Other lives",
  personal: "Something personal",
}

const REAL_CONVERSATIONS_LABELS: Record<string, string> = {
  yes: "Yes",
  no: "No",
}

const DISTANCE_LABELS: Record<string, string> = {
  "still-there": "Still there",
  "another-country": "Another country",
  "lost-count": "Lost count",
}

const COLUMN_COUNT = 9

export default function RegistrationSurveysPage() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["registration-surveys", "admin", page, pageSize],
    queryFn: () => fetchRegistrationSurveysApi(page, pageSize),
    placeholderData: keepPreviousData,
  })

  const rows = data?.data ?? []
  const meta = data?.meta
  const totalPages = meta?.totalPages ?? 1

  function handlePageSizeChange(value: string | null) {
    if (!value) return
    setPageSize(Number(value))
    setPage(1)
  }

  const headers = (
    <TableRow>
      <TableHead>{t("Name")}</TableHead>
      <TableHead>{t("What brought them here")}</TableHead>
      <TableHead>{t("Age")}</TableHead>
      <TableHead>{t("Real conversations?")}</TableHead>
      <TableHead>{t("Days")}</TableHead>
      <TableHead>{t("Distance from home")}</TableHead>
      <TableHead>{t("Circles")}</TableHead>
      <TableHead>{t("What stops them")}</TableHead>
      <TableHead>{t("Date")}</TableHead>
    </TableRow>
  )

  const heading = (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">
        {t("Registration Surveys")}
      </h2>
      <p className="text-muted-foreground">
        {t("Answers from the pre-account registration flow.")}
      </p>
    </div>
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        {heading}
        <div className="rounded-lg border">
          <Table>
            <TableHeader>{headers}</TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: COLUMN_COUNT }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-4">
        {heading}
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <AlertCircleIcon className="size-10 text-destructive" />
          <p className="text-muted-foreground">
            {t(error.message) || t("Failed to load registration surveys.")}
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
      {heading}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>{headers}</TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="h-24 text-center">
                  {t("No registration surveys yet.")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row: AdminRegistrationSurvey) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="whitespace-nowrap font-medium">
                      {row.userName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.userEmail}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {t(INTENT_LABELS[row.intent] ?? row.intent)}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {row.ageRange}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.realConversations === "yes" ? "default" : "outline"
                      }
                    >
                      {t(
                        REAL_CONVERSATIONS_LABELS[row.realConversations] ??
                          row.realConversations,
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[180px]">
                    <span className="line-clamp-2 text-sm">{row.daysSpent}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {t(DISTANCE_LABELS[row.distanceFromHome] ??
                        row.distanceFromHome)}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    {row.circles.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {row.circles.map((circle) => (
                          <Badge
                            key={circle}
                            variant="secondary"
                            className="whitespace-nowrap"
                          >
                            {circle}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[220px]">
                    <span className="line-clamp-3 text-sm">{row.blocker}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {new Date(row.createdAt).toLocaleDateString(i18n.language, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
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
            {t("{{count}} survey total", { count: meta.total })}
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label
                htmlFor="registration-surveys-rows-per-page"
                className="text-sm font-medium"
              >
                {t("Rows per page")}
              </Label>
              <Select
                value={String(pageSize)}
                onValueChange={handlePageSizeChange}
              >
                <SelectTrigger
                  size="sm"
                  className="w-20"
                  id="registration-surveys-rows-per-page"
                >
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
    </div>
  )
}
