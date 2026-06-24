import { AdminDashboardLayout } from "@/components/admin-dashboard-layout"
import { UserDashboardLayout } from "@/components/user-dashboard-layout"
import { useAuth } from "@/hooks/use-auth"
import { useTimezoneSync } from "@/hooks/use-timezone-sync"

export function DashboardLayout() {
  const { user } = useAuth()
  // Backfill a real timezone for accounts still on the "UTC" default so
  // confirmation emails render in local time.
  useTimezoneSync()
  return user?.role === "admin" ? (
    <AdminDashboardLayout />
  ) : (
    <UserDashboardLayout />
  )
}
