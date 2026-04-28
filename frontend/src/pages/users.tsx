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
import type { User } from "@base-dashboard/shared"
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
  TrashIcon,
  ChevronsLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsRightIcon,
  PlusIcon,
} from "lucide-react"
import { toast } from "sonner"

export default function UsersPage() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["users", page, pageSize],
    queryFn: () => fetchUsersApi(page, pageSize),
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
      toast.error(error.message || t("Failed to update role"))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => removeUserApi(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      toast.success(t("User deleted"))
    },
    onError: (error: Error) => {
      toast.error(error.message || t("Failed to delete user"))
    },
  })

  function handleRoleChange(userId: string, role: string) {
    updateRoleMutation.mutate({ userId, role })
  }

  function handleDelete(userId: string) {
    deleteMutation.mutate(userId)
  }

  function handlePageSizeChange(value: string | null) {
    if (!value) return
    setPageSize(Number(value))
    setPage(1)
  }

  const totalPages = meta?.totalPages ?? 1

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
                <TableHead>{t("Name")}</TableHead>
                <TableHead>{t("Email")}</TableHead>
                <TableHead>{t("Role")}</TableHead>
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
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-20" />
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
            {error.message || t("Failed to load users.")}
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
        <Button onClick={() => setAddDialogOpen(true)}>
          <PlusIcon className="size-4" />
          {t("Add User")}
        </Button>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Name")}</TableHead>
              <TableHead>{t("Email")}</TableHead>
              <TableHead>{t("Role")}</TableHead>
              <TableHead className="w-25">{t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  {t("No users found.")}
                </TableCell>
              </TableRow>
            ) : (
              users.map((u: User) => {
                const isSelf = u.id === currentUser?.id
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      {isSelf ? (
                        <Badge variant="secondary">{u.role}</Badge>
                      ) : (
                        <Select
                          value={u.role}
                          onValueChange={(val) =>
                            val && handleRoleChange(u.id, val)
                          }
                        >
                          <SelectTrigger size="sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">admin</SelectItem>
                            <SelectItem value="user">user</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isSelf}
                        onClick={() => handleDelete(u.id)}
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
      <AddUserDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
    </div>
  )
}
