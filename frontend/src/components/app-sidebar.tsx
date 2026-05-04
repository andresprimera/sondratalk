import * as React from "react"
import { useTranslation } from "react-i18next"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  LayoutDashboardIcon,
  UsersIcon,
  Settings2Icon,
  CommandIcon,
  LayersIcon,
  CircleDotIcon,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { Link } from "react-router"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"

  const adminNavMain = [
    { title: t("Dashboard"), url: "/dashboard", icon: <LayoutDashboardIcon /> },
    { title: t("Users"), url: "/dashboard/users", icon: <UsersIcon /> },
    { title: t("Themes"), url: "/dashboard/themes", icon: <LayersIcon /> },
    { title: t("Circles"), url: "/dashboard/circles", icon: <CircleDotIcon /> },
  ]

  const userNavMain = [
    { title: t("Dashboard"), url: "/dashboard", icon: <LayoutDashboardIcon /> },
  ]

  const navSecondary = [
    { title: t("Settings"), url: "/dashboard/settings", icon: <Settings2Icon /> },
  ]

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link to="/dashboard" />}
            >
              <CommandIcon className="size-5!" />
              <span className="text-base font-semibold">Acme Inc.</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={isAdmin ? adminNavMain : userNavMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
