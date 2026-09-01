import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { fetchAdminMeetingsApi } from "@/lib/meetings"
import type { AdminMeeting } from "@base-dashboard/shared"
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

const COLUMN_COUNT = 5

function ParticipantCell({
  participants,
}: {
  participants: AdminMeeting["participants"]
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {participants.map((p) => (
        <div key={p.id}>
          <div className="font-medium whitespace-nowrap">{p.name}</div>
          <div className="text-xs text-muted-foreground">{p.email}</div>
        </div>
      ))}
    </div>
  )
}

export default function AdminMeetingsPage() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["meetings", "admin", page, pageSize],
    queryFn: () => fetchAdminMeetingsApi(page, pageSize),
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
      <TableHead>{t("Participants")}</TableHead>
      <TableHead>{t("Booked by")}</TableHead>
      <TableHead>{t("When")}</TableHead>
      <TableHead>{t("Type")}</TableHead>
      <TableHead>{t("Status")}</TableHead>
    </TableRow>
  )

  const heading = (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">{t("Appointments")}</h2>
      <p className="text-muted-foreground">
        {t("Booked appointments across the platform.")}
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
            {t(error.message) || t("Failed to load appointments.")}
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
                  {t("No appointments yet.")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row: AdminMeeting) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <ParticipantCell participants={row.participants} />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium whitespace-nowrap">
                      {row.bookedBy.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.bookedBy.email}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {new Date(row.scheduledAt).toLocaleString(i18n.language, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.instant ? "default" : "secondary"}>
                      {row.instant ? t("Instant") : t("Scheduled")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.cancelled ? "destructive" : "outline"}>
                      {row.cancelled ? t("Cancelled") : t("Booked")}
                    </Badge>
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
            {t("{{count}} appointment total", { count: meta.total })}
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label
                htmlFor="appointments-rows-per-page"
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
                  id="appointments-rows-per-page"
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
