import { AdminDashboardLayout } from "@/components/admin-dashboard-layout"
import { UserDashboardLayout } from "@/components/user-dashboard-layout"
import { useAuth } from "@/hooks/use-auth"
import { usePresenceHeartbeat } from "@/hooks/use-presence-heartbeat"
import { useTimezoneSync } from "@/hooks/use-timezone-sync"

export function DashboardLayout() {
  const { user } = useAuth()
  // Backfill a real timezone for accounts still on the "UTC" default so
  // confirmation emails render in local time.
  useTimezoneSync()
  // Keep both admins and users fresh in the live pool. Mounted here (not in a
  // role-specific layout) so admins who mark themselves available also beat.
  usePresenceHeartbeat()
  return user?.role === "admin" ? (
    <AdminDashboardLayout />
  ) : (
    <UserDashboardLayout />
  )
}
