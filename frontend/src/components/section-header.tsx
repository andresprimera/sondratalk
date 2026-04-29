import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface SectionHeaderProps {
  title: string
  action?: ReactNode
  className?: string
}

export function SectionHeader({ title, action, className }: SectionHeaderProps) {
  return (
    <div
      className={cn("mb-4 flex items-baseline justify-between", className)}
    >
      <h6>{title}</h6>
      {action}
    </div>
  )
}
