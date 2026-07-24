import { Outlet } from "react-router"
import { UserSiteHeader } from "@/components/user-site-header"

export function UserDashboardLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <UserSiteHeader />
      <main className="flex flex-1 flex-col gap-4 p-4">
        <Outlet />
      </main>
    </div>
  )
}
