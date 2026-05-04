import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { AlertCircleIcon, ArrowRight } from "lucide-react"
import { ConversationCard } from "@/components/conversation-card"
import { CopyableInput } from "@/components/copyable-input"
import { SectionHeader } from "@/components/section-header"
import { StatsStrip } from "@/components/stats-strip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/use-auth"
import i18n from "@/lib/i18n"
import { fetchMyCirclesApi } from "@/lib/memberships"

const stats = { conversations: 23, activeSince: "Mar 2024", hosted: 8 }
const lastConversation = {
  name: "Ana",
  circles: ["Catalan", "Restaurant owner"],
  date: new Date("2026-04-28"),
  duration: "42 min",
  notes:
    "She had an interesting take on balancing a small restaurant through slow seasons. Made me think differently about fixed vs variable costs. Want to speak to her again.",
}
const referralUrl = "sondratalk.com/join/raul-h23k"

export default function DashboardPage() {
  const { t, i18n: i18nInstance } = useTranslation()
  const locale: "en" | "es" =
    i18nInstance.language?.split("-")[0] === "es" ? "es" : "en"
  const { user } = useAuth()

  const myCirclesQuery = useQuery({
    queryKey: ["users", "me", "circles"] as const,
    queryFn: fetchMyCirclesApi,
  })

  const hour = new Date().getHours()
  const greeting =
    hour < 12
      ? t("Good morning")
      : hour < 18
        ? t("Good afternoon")
        : t("Good evening")

  const lastConversationDate = lastConversation.date.toLocaleDateString(
    i18n.language,
    { weekday: "short", day: "numeric", month: "short" },
  )

  return (
    <div className="mx-auto w-full max-w-2xl py-8">
      <section>
        <p className="text-sm text-muted-foreground">
          {greeting}, {user?.name}.
        </p>
        <h1 className="mt-2 mb-6">{t("Who do you need to talk to today?")}</h1>
        <div className="flex flex-wrap gap-3">
          <Button>
            {t("Find a Conversation")} <ArrowRight />
          </Button>
          <Button variant="outline">{t("Talk Now")}</Button>
        </div>
      </section>

      <Separator className="my-8" />

      <StatsStrip
        stats={[
          { value: stats.conversations, label: t("Conversations") },
          {
            value: stats.activeSince,
            label: t("Active since"),
            valueClassName: "text-base",
          },
          {
            value: stats.hosted,
            label: t("as listener or adviser"),
            badge: <Badge variant="outline">{t("Host Exp")}</Badge>,
          },
        ]}
      />

      <Separator className="my-8" />

      <section>
        <SectionHeader
          title={t("Your Circles")}
          action={
            <Button variant="ghost" size="sm" disabled>
              {t("Edit")}
            </Button>
          }
        />
        {myCirclesQuery.isLoading ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-20 rounded-full" />
            ))}
          </div>
        ) : myCirclesQuery.isError ? (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <AlertCircleIcon className="size-4 text-destructive" />
            <span>{t("Failed to load circles.")}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => myCirclesQuery.refetch()}
            >
              {t("Try again")}
            </Button>
          </div>
        ) : (myCirclesQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("You haven't picked any circles yet.")}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(myCirclesQuery.data ?? []).map((c) => (
              <Badge key={c.id} variant="secondary">
                {c.labels[locale]}
              </Badge>
            ))}
          </div>
        )}
      </section>

      <Separator className="my-8" />

      <section>
        <SectionHeader title={t("Last Conversation")} />
        <ConversationCard
          name={lastConversation.name}
          circles={lastConversation.circles}
          date={lastConversationDate}
          duration={lastConversation.duration}
          notes={lastConversation.notes}
        />
        <div className="mt-2 flex justify-end">
          <Button variant="link" size="sm">
            {t("See all conversations")} <ArrowRight />
          </Button>
        </div>
      </section>

      <Separator className="my-8" />

      <section>
        <Card>
          <CardHeader>
            <CardTitle>{t("Know someone who belongs here?")}</CardTitle>
            <CardDescription>
              {t(
                "Invite them with your personal link. Every conversation starts with a person vouching for another.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CopyableInput
              value={referralUrl}
              copyValue={`https://${referralUrl}`}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
