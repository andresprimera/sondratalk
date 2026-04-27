import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TrendingUpIcon, TrendingDownIcon, type LucideIcon } from "lucide-react"

type Trend = "up" | "down"

interface DashboardCardProps {
  label: string
  value: string
  badge: string
  trend: Trend
  footerText: string
  footerDescription: string
  footerIcon?: LucideIcon
}

const trendIcons: Record<Trend, LucideIcon> = {
  up: TrendingUpIcon,
  down: TrendingDownIcon,
}

export function DashboardCard({
  label,
  value,
  badge,
  trend,
  footerText,
  footerDescription,
  footerIcon,
}: DashboardCardProps) {
  const TrendIcon = trendIcons[trend]
  const FooterIcon = footerIcon ?? TrendIcon

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {value}
        </CardTitle>
        <CardAction>
          <Badge variant="outline">
            <TrendIcon />
            {badge}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="line-clamp-1 flex gap-2 font-medium">
          {footerText} <FooterIcon className="size-4" />
        </div>
        <div className="text-muted-foreground">{footerDescription}</div>
      </CardFooter>
    </Card>
  )
}
