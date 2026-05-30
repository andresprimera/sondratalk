import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { HeaderUser } from "@/components/header-user"
import { LanguageToggle } from "@/components/language-toggle"
import { ThemeToggle } from "@/components/theme-toggle"

export function UserSiteHeader() {
  const { t } = useTranslation()
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <span className="flex items-center gap-1.5">
          <span className="font-heading text-xl">Sondra</span>
          <Badge variant="outline" className="text-[0.625rem] tracking-wider uppercase">
            {t("Beta")}
          </Badge>
        </span>
        <div className="ml-auto flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
          <HeaderUser />
        </div>
      </div>
    </header>
  )
}
