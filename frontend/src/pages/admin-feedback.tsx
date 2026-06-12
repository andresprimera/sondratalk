import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { fetchAdminFeedbackApi } from "@/lib/feedback"
import type { AdminFeedback } from "@base-dashboard/shared"
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
  StarIcon,
} from "lucide-react"
import i18n from "@/lib/i18n"

const TALK_AGAIN_LABELS: Record<string, string> = {
  yes: "Yes",
  maybe: "Maybe",
  no: "No",
}

const CIRCLES_RELEVANT_LABELS: Record<string, string> = {
  yes: "Yes",
  somewhat: "Somewhat",
  not_really: "Not really",
}

const AV_QUALITY_LABELS: Record<string, string> = {
  good: "Good",
  minor_issues: "Minor issues",
  significant_problems: "Significant problems",
}

const REPORT_REASON_LABELS: Record<string, string> = {
  disrespectful: "Disrespectful",
  inappropriate: "Inappropriate",
  no_show: "No-show",
  solicitation: "Solicitation",
  unsafe: "Unsafe",
  other: "Other",
}

export default function AdminFeedbackPage() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["feedback", "admin", page, pageSize],
    queryFn: () => fetchAdminFeedbackApi(page, pageSize),
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {t("Survey Answers")}
          </h2>
          <p className="text-muted-foreground">
            {t("Post-conversation feedback from participants.")}
          </p>
        </div>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Name")}</TableHead>
                <TableHead>{t("Conv. #")}</TableHead>
                <TableHead>{t("Talk again?")}</TableHead>
                <TableHead>{t("Circles relevant?")}</TableHead>
                <TableHead>{t("AV quality")}</TableHead>
                <TableHead>{t("Rating")}</TableHead>
                <TableHead>{t("Feeling")}</TableHead>
                <TableHead>{t("Notes")}</TableHead>
                <TableHead>{t("Report")}</TableHead>
                <TableHead>{t("Date")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 10 }).map((__, j) => (
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
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {t("Survey Answers")}
          </h2>
          <p className="text-muted-foreground">
            {t("Post-conversation feedback from participants.")}
          </p>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <AlertCircleIcon className="size-10 text-destructive" />
          <p className="text-muted-foreground">
            {t(error.message) || t("Failed to load survey answers.")}
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
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {t("Survey Answers")}
        </h2>
        <p className="text-muted-foreground">
          {t("Post-conversation feedback from participants.")}
        </p>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Name")}</TableHead>
              <TableHead>{t("Conv. #")}</TableHead>
              <TableHead>{t("Talk again?")}</TableHead>
              <TableHead>{t("Circles relevant?")}</TableHead>
              <TableHead>{t("AV quality")}</TableHead>
              <TableHead>{t("Rating")}</TableHead>
              <TableHead>{t("Feeling")}</TableHead>
              <TableHead>{t("Notes")}</TableHead>
              <TableHead>{t("Report")}</TableHead>
              <TableHead>{t("Date")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center">
                  {t("No survey answers yet.")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row: AdminFeedback) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="whitespace-nowrap font-medium">
                      {row.userName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.userEmail}
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    #{row.userConversationIndex}
                  </TableCell>
                  <TableCell>
                    {row.talkAgain ? (
                      <Badge
                        variant={
                          row.talkAgain === "yes"
                            ? "default"
                            : row.talkAgain === "maybe"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {t(TALK_AGAIN_LABELS[row.talkAgain] ?? row.talkAgain)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.circlesRelevant ? (
                      <span className="text-sm">
                        {t(
                          CIRCLES_RELEVANT_LABELS[row.circlesRelevant] ??
                            row.circlesRelevant,
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.avQuality ? (
                      <span className="text-sm">
                        {t(
                          AV_QUALITY_LABELS[row.avQuality] ?? row.avQuality,
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.matchRating != null ? (
                      <div className="flex items-center gap-1">
                        <StarIcon className="size-3 fill-current text-yellow-500" />
                        <span className="text-sm">{row.matchRating}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    {row.feeling ? (
                      <span className="line-clamp-3 text-sm">{row.feeling}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    {row.privateNotes ? (
                      <span className="line-clamp-3 text-sm">
                        {row.privateNotes}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.report ? (
                      <Badge variant="destructive" className="whitespace-nowrap">
                        {t(REPORT_REASON_LABELS[row.report.reason] ?? row.report.reason)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {new Date(row.createdAt).toLocaleDateString(
                      i18n.language,
                      { month: "short", day: "numeric", year: "numeric" },
                    )}
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
                htmlFor="feedback-rows-per-page"
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
                  id="feedback-rows-per-page"
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
