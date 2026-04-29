import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface ConversationCardProps {
  name: string
  circles: string[]
  date: string
  duration: string
  notes?: string
}

export function ConversationCard({
  name,
  circles,
  date,
  duration,
  notes,
}: ConversationCardProps) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <CardTitle>{name}</CardTitle>
          <div className="flex flex-wrap gap-1">
            {circles.map((circle) => (
              <Badge key={circle} variant="outline">
                {circle}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="text-sm text-muted-foreground">{date}</div>
          <div>{duration}</div>
        </div>
      </CardHeader>
      {notes !== undefined && (
        <CardContent>
          <h6 className="mb-2">{t("Your notes")}</h6>
          <p className="text-sm text-muted-foreground">{notes}</p>
        </CardContent>
      )}
    </Card>
  )
}
