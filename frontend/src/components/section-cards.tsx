import { useTranslation } from "react-i18next"
import { DashboardCard } from "@/components/dashboard-card"

export function SectionCards() {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <DashboardCard
        label={t("Total Revenue")}
        value="$1,250.00"
        badge="+12.5%"
        trend="up"
        footerText={t("Trending up this month")}
        footerDescription={t("Visitors for the last 6 months")}
      />
      <DashboardCard
        label={t("New Customers")}
        value="1,234"
        badge="-20%"
        trend="down"
        footerText={t("Down 20% this period")}
        footerDescription={t("Acquisition needs attention")}
      />
      <DashboardCard
        label={t("Active Accounts")}
        value="45,678"
        badge="+12.5%"
        trend="up"
        footerText={t("Strong user retention")}
        footerDescription={t("Engagement exceed targets")}
      />
      <DashboardCard
        label={t("Growth Rate")}
        value="4.5%"
        badge="+4.5%"
        trend="up"
        footerText={t("Steady performance increase")}
        footerDescription={t("Meets growth projections")}
      />
    </div>
  )
}
