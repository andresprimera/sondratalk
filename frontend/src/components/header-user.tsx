import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserMenuItems } from "@/components/user-menu-items"
import { useAuth } from "@/hooks/use-auth"
import { getInitials } from "@/lib/utils"

export function HeaderUser() {
  const { user } = useAuth()

  if (!user) return null

  const initials = getInitials(user.name)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="sm" className="gap-2 px-2" />}
      >
        <Avatar className="size-7">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <span className="hidden sm:inline">{user.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56" align="end" sideOffset={4}>
        <UserMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
