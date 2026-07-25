import { useState } from "react"
import { AddUserDialog } from "@/components/add-user-dialog"
import { useTranslation } from "react-i18next"
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query"
import { useAuth } from "@/hooks/use-auth"
import { fetchUsersApi, updateUserRoleApi, removeUserApi } from "@/lib/users"
import type { AdminUser, UsersQuery } from "@base-dashboard/shared"
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
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertCircleIcon,
  TrashIcon,
  ChevronsLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsRightIcon,
  PlusIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowUpDownIcon,
} from "lucide-react"
import { toast } from "sonner"
import i18n from "@/lib/i18n"
import { ROLE_LABELS } from "@/lib/roles"

type SortBy = NonNullable<UsersQuery["sortBy"]>
type SortDir = NonNullable<UsersQuery["sortDir"]>

function SortIcon({ col, sortBy, sortDir }: { col: SortBy; sortBy: SortBy; sortDir: SortDir }) {
  if (sortBy !== col) return <ArrowUpDownIcon className="ml-1 inline size-3 opacity-40" />
  return sortDir === "asc"
    ? <ArrowUpIcon className="ml-1 inline size-3" />
    : <ArrowDownIcon className="ml-1 inline size-3" />
}

export default function UsersPage() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortBy, setSortBy] = useState<SortBy>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["users", page, pageSize, sortBy, sortDir],
    queryFn: () => fetchUsersApi(page, pageSize, sortBy, sortDir),
    placeholderData: keepPreviousData,
  })

  const users = data?.data ?? []
  const meta = data?.meta

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      updateUserRoleApi(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      toast.success(t("Role updated"))
    },
    onError: (error: Error) => {
      toast.error(t(error.message) || t("Failed to update role"))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => removeUserApi(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      toast.success(t("User deleted"))
    },
    onError: (error: Error) => {
      toast.error(t(error.message) || t("Failed to delete user"))
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.allSettled(ids.map((id) => removeUserApi(id))),
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      const failed = results.filter((r) => r.status === "rejected").length
      if (failed > 0) {
        toast.error(t("{{count}} deletion(s) failed", { count: failed }))
      } else {
        toast.success(t("Selected users deleted"))
      }
    },
  })

  function handleRoleChange(userId: string, role: string) {
    updateRoleMutation.mutate({ userId, role })
  }

  function handleDelete() {
    if (!deleteUserId) return
    deleteMutation.mutate(deleteUserId, {
      onSettled: () => setDeleteUserId(null),
    })
  }

  function handleBulkDelete() {
    const ids = [...selected].filter((id) => id !== currentUser?.id)
    setBulkDeleteOpen(false)
    setSelected(new Set())
    bulkDeleteMutation.mutate(ids)
  }

  function handlePageSizeChange(value: string | null) {
    if (!value) return
    setPageSize(Number(value))
    setPage(1)
  }

  function handleSort(col: SortBy) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(col)
      setSortDir("asc")
    }
    setPage(1)
    setSelected(new Set())
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const totalPages = meta?.totalPages ?? 1
  const pageIds = users.map((u) => u.id)

  function toggleAll() {
    const allSelected = pageIds.every((id) => selected.has(id))
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id))
      } else {
        pageIds.forEach((id) => next.add(id))
      }
      return next
    })
  }
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const somePageSelected = pageIds.some((id) => selected.has(id))
  const selectedCount = selected.size
  const selectedNonSelf = [...selected].filter((id) => id !== currentUser?.id).length

  const colCount = 8

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{t("Users")}</h2>
            <p className="text-muted-foreground">
              {t("Manage user accounts and roles.")}
            </p>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <PlusIcon className="size-4" />
            {t("Add User")}
          </Button>
        </div>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>{t("Name")}</TableHead>
                <TableHead>{t("Email")}</TableHead>
                <TableHead>{t("Role")}</TableHead>
                <TableHead>{t("Conversations")}</TableHead>
                <TableHead>{t("Host Exp")}</TableHead>
                <TableHead>{t("Active since")}</TableHead>
                <TableHead className="w-20">{t("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: pageSize > 5 ? 5 : pageSize }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: colCount }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{t("Users")}</h2>
            <p className="text-muted-foreground">
              {t("Manage user accounts and roles.")}
            </p>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <PlusIcon className="size-4" />
            {t("Add User")}
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <AlertCircleIcon className="size-10 text-destructive" />
          <p className="text-muted-foreground">
            {t(error.message) || t("Failed to load users.")}
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("Users")}</h2>
          <p className="text-muted-foreground">
            {t("Manage user accounts and roles.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              disabled={selectedNonSelf === 0}
              onClick={() => setBulkDeleteOpen(true)}
            >
              <TrashIcon className="size-4" />
              {t("Delete {{count}} selected", { count: selectedNonSelf })}
            </Button>
          )}
          <Button onClick={() => setAddDialogOpen(true)}>
            <PlusIcon className="size-4" />
            {t("Add User")}
          </Button>
        </div>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allPageSelected}
                  indeterminate={somePageSelected && !allPageSelected}
                  onCheckedChange={toggleAll}
                  aria-label={t("Select all")}
                />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("name")}
              >
                {t("Name")}
                <SortIcon col="name" sortBy={sortBy} sortDir={sortDir} />
              </TableHead>
              <TableHead>{t("Email")}</TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("role")}
              >
                {t("Role")}
                <SortIcon col="role" sortBy={sortBy} sortDir={sortDir} />
              </TableHead>
              <TableHead>{t("Conversations")}</TableHead>
              <TableHead>{t("Host Exp")}</TableHead>
              <TableHead>{t("Active since")}</TableHead>
              <TableHead className="w-20">{t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="h-24 text-center">
                  {t("No users found.")}
                </TableCell>
              </TableRow>
            ) : (
              users.map((u: AdminUser) => {
                const isSelf = u.id === currentUser?.id
                return (
                  <TableRow
                    key={u.id}
                    data-state={selected.has(u.id) ? "selected" : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(u.id)}
                        onCheckedChange={() => toggleRow(u.id)}
                        aria-label={t("Select {{name}}", { name: u.name })}
                      />
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      {isSelf ? (
                        <Badge variant="secondary">
                          {t(ROLE_LABELS[u.role] ?? u.role)}
                        </Badge>
                      ) : (
                        <Select
                          value={u.role}
                          onValueChange={(val) => val && handleRoleChange(u.id, val)}
                        >
                          <SelectTrigger size="sm">
                            <SelectValue>
                              {t(ROLE_LABELS[u.role] ?? u.role)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">{t("Admin")}</SelectItem>
                            <SelectItem value="user">{t("User")}</SelectItem>
                            <SelectItem value="founding_member">{t("Founding Member")}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {u.conversationCount}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {u.hostExpPoints}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString(i18n.language, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isSelf}
                        onClick={() => setDeleteUserId(u.id)}
                      >
                        <TrashIcon className="size-4" />
                        <span className="sr-only">{t("Delete")}</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
      {meta && (
        <div className="flex items-center justify-between px-4">
          <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            {t("{{count}} user total", { count: meta.total })}
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
        open={deleteUserId !== null}
        onOpenChange={(open) => { if (!open) setDeleteUserId(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete user")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("This action cannot be undone. This will permanently delete the user account.")}
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
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete selected users")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("This will permanently delete {{count}} user(s). This cannot be undone.", { count: selectedNonSelf })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? t("Deleting...") : t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AddUserDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
    </div>
  )
}
