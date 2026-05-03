import * as React from "react"
import { useTranslation } from "react-i18next"

import { NavDocuments } from "@/components/nav-documents"
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
  ListIcon,
  ChartBarIcon,
  FolderIcon,
  UsersIcon,
  Settings2Icon,
  CircleHelpIcon,
  SearchIcon,
  DatabaseIcon,
  FileChartColumnIcon,
  FileIcon,
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
    { title: t("Lifecycle"), url: "#", icon: <ListIcon /> },
    { title: t("Analytics"), url: "#", icon: <ChartBarIcon /> },
    { title: t("Projects"), url: "#", icon: <FolderIcon /> },
    { title: t("Team"), url: "#", icon: <UsersIcon /> },
    { title: t("Users"), url: "/dashboard/users", icon: <UsersIcon /> },
    { title: t("Themes"), url: "/dashboard/themes", icon: <LayersIcon /> },
    { title: t("Circles"), url: "/dashboard/circles", icon: <CircleDotIcon /> },
  ]

  const userNavMain = [
    { title: t("Dashboard"), url: "/dashboard", icon: <LayoutDashboardIcon /> },
  ]

  const navSecondary = [
    { title: t("Settings"), url: "/dashboard/settings", icon: <Settings2Icon /> },
    { title: t("Get Help"), url: "#", icon: <CircleHelpIcon /> },
    { title: t("Search"), url: "#", icon: <SearchIcon /> },
  ]

  const documents = [
    { name: t("Data Library"), url: "#", icon: <DatabaseIcon /> },
    { name: t("Reports"), url: "#", icon: <FileChartColumnIcon /> },
    { name: t("Word Assistant"), url: "#", icon: <FileIcon /> },
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
        {isAdmin && <NavDocuments items={documents} />}
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
