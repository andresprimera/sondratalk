import { useTranslation } from "react-i18next"
import { ProfileForm } from "@/components/profile-form"
import { ChangePasswordForm } from "@/components/change-password-form"
import { TimezoneForm } from "@/components/timezone-form"

export default function SettingsPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("Settings")}</h2>
        <p className="text-muted-foreground">
          {t("Manage your account settings and preferences.")}
        </p>
      </div>
      <div className="flex flex-col gap-6 max-w-2xl">
        <ProfileForm />
        <TimezoneForm />
        <ChangePasswordForm />
      </div>
    </div>
  )
}
