import { AdminDashboardLayout } from "@/components/admin-dashboard-layout"
import { UserDashboardLayout } from "@/components/user-dashboard-layout"
import { useAuth } from "@/hooks/use-auth"

export function DashboardLayout() {
  const { user } = useAuth()
  return user?.role === "admin" ? (
    <AdminDashboardLayout />
  ) : (
    <UserDashboardLayout />
  )
}
