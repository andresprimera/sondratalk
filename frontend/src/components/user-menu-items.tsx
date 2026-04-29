import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router"
import {
  BellIcon,
  CircleUserRoundIcon,
  CreditCardIcon,
  LogOutIcon,
  Settings2Icon,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/use-auth"
import { getInitials } from "@/lib/utils"

export function UserMenuItems() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const initials = getInitials(user.name)

  async function handleLogout() {
    await logout()
    navigate("/")
  }

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="size-8">
              <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem>
          <CircleUserRoundIcon />
          {t("Account")}
        </DropdownMenuItem>
        <DropdownMenuItem>
          <CreditCardIcon />
          {t("Billing")}
        </DropdownMenuItem>
        <DropdownMenuItem>
          <BellIcon />
          {t("Notifications")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link to="/dashboard/settings" />}>
          <Settings2Icon />
          {t("Settings")}
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={handleLogout}>
        <LogOutIcon />
        {t("Log out")}
      </DropdownMenuItem>
    </>
  )
}
