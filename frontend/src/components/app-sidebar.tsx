import * as React from "react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
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
  LayersIcon,
  CircleDotIcon,
  ClipboardListIcon,
  ClipboardCheckIcon,
  MessageSquareTextIcon,
  RadioTowerIcon,
  CalendarCheckIcon,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { Link } from "react-router"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"

  const adminNavMain = [
    { title: t("Dashboard"), url: "/dashboard", icon: <LayoutDashboardIcon />, end: true },
    { title: t("Users"), url: "/dashboard/users", icon: <UsersIcon /> },
    { title: t("Available Now"), url: "/dashboard/available-now", icon: <RadioTowerIcon /> },
    { title: t("Themes"), url: "/dashboard/themes", icon: <LayersIcon /> },
    { title: t("Circles"), url: "/dashboard/circles", icon: <CircleDotIcon /> },
    {
      title: t("Applications"),
      url: "/dashboard/applications",
      icon: <ClipboardListIcon />,
    },
    {
      title: t("Survey Answers"),
      url: "/dashboard/survey-answers",
      icon: <MessageSquareTextIcon />,
    },
    {
      title: t("Registration Surveys"),
      url: "/dashboard/registration-surveys",
      icon: <ClipboardCheckIcon />,
    },
    {
      title: t("Appointments"),
      url: "/dashboard/appointments",
      icon: <CalendarCheckIcon />,
    },
  ]

  const userNavMain = [
    { title: t("Dashboard"), url: "/dashboard", icon: <LayoutDashboardIcon />, end: true },
  ]

  const navSecondary = [
    { title: t("My Circles"), url: "/dashboard/my-circles", icon: <CircleDotIcon /> },
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
              <span className="font-heading text-xl">Sondra</span>
              <Badge
                variant="outline"
                className="text-[0.625rem] tracking-wider uppercase"
              >
                {t("Beta")}
              </Badge>
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
