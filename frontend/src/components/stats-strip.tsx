import { Fragment, type ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export interface StatItem {
  value: ReactNode
  label: string
  badge?: ReactNode
  valueClassName?: string
}

interface StatsStripProps {
  stats: StatItem[]
}

export function StatsStrip({ stats }: StatsStripProps) {
  return (
    <Card>
      <CardContent className="flex items-stretch p-0">
        {stats.map((stat, i) => (
          <Fragment key={stat.label}>
            <div className="flex flex-1 flex-col gap-1 p-6">
              <div className={cn("text-2xl", stat.valueClassName)}>
                {stat.value}
              </div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
              {stat.badge && <div className="mt-1">{stat.badge}</div>}
            </div>
            {i < stats.length - 1 && <Separator orientation="vertical" />}
          </Fragment>
        ))}
      </CardContent>
    </Card>
  )
}
