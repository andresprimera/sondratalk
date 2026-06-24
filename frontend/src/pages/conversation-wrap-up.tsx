import { useState } from "react"
import { Link, useParams } from "react-router"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery } from "@tanstack/react-query"
import { AlertCircleIcon, StarIcon } from "lucide-react"
import { toast } from "sonner"
import type {
  AvQuality,
  CirclesRelevant,
  ExchangedContact,
  ReportReason,
  SubmitConversationFeedbackInput,
  TalkAgain,
} from "@base-dashboard/shared"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { fetchMeetingByIdApi } from "@/lib/meetings"
import { submitConversationFeedbackApi } from "@/lib/feedback"
import { cn } from "@/lib/utils"
import i18n from "@/lib/i18n"

interface ChipOption<T extends string> {
  value: T
  label: string
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ChipOption<T>[]
  value: T | null
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <Button
          key={opt.value}
          type="button"
          size="sm"
          variant={value === opt.value ? "secondary" : "outline"}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  )
}

export default function ConversationWrapUpPage() {
  const { t } = useTranslation()
  const params = useParams<{ meetingId: string }>()
  const meetingId = params.meetingId ?? ""

  const meetingQuery = useQuery({
    queryKey: ["meetings", meetingId] as const,
    queryFn: () => fetchMeetingByIdApi(meetingId),
    enabled: meetingId.length > 0,
    retry: false,
  })

  const [talkAgain, setTalkAgain] = useState<TalkAgain | null>(null)
  const [doorOpen, setDoorOpen] = useState(false)
  const [doorNote, setDoorNote] = useState("")
  const [dontMatchAgain, setDontMatchAgain] = useState(false)
  const [feeling, setFeeling] = useState("")
  const [circlesRelevant, setCirclesRelevant] =
    useState<CirclesRelevant | null>(null)
  const [exchangedContact, setExchangedContact] =
    useState<ExchangedContact | null>(null)
  const [avQuality, setAvQuality] = useState<AvQuality | null>(null)
  const [matchRating, setMatchRating] = useState(0)
  const [privateNotes, setPrivateNotes] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState<ReportReason | null>(null)
  const [reportDetail, setReportDetail] = useState("")

  const mutation = useMutation({
    mutationFn: submitConversationFeedbackApi,
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : t("We couldn't save your feedback."),
      )
    },
  })

  const peerName = meetingQuery.data?.peer.firstName || t("Your match")

  const startedAt = meetingQuery.data
    ? new Date(meetingQuery.data.scheduledAt).toLocaleString(i18n.language, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null

  function handleDone() {
    const payload: SubmitConversationFeedbackInput = { meetingId, doorOpen }
    if (talkAgain) payload.talkAgain = talkAgain
    if (doorOpen && doorNote.trim()) payload.doorNote = doorNote.trim()
    if (dontMatchAgain) payload.dontMatchAgain = true
    if (feeling.trim()) payload.feeling = feeling.trim()
    if (circlesRelevant) payload.circlesRelevant = circlesRelevant
    if (exchangedContact) payload.exchangedContact = exchangedContact
    if (avQuality) payload.avQuality = avQuality
    if (matchRating > 0) payload.matchRating = matchRating
    if (privateNotes.trim()) payload.privateNotes = privateNotes.trim()

    mutation.mutate(payload, {
      onSuccess: () => setSubmitted(true),
    })
  }

  function handleSendReport() {
    if (!reportReason) return
    mutation.mutate(
      {
        meetingId,
        report: {
          reason: reportReason,
          ...(reportDetail.trim() ? { detail: reportDetail.trim() } : {}),
        },
      },
      {
        onSuccess: () => {
          setReportOpen(false)
          toast.success(t("Report sent. Thank you for letting us know."))
        },
      },
    )
  }

  const talkAgainOptions: ChipOption<TalkAgain>[] = [
    { value: "yes", label: t("Yes") },
    { value: "maybe", label: t("Maybe") },
    { value: "no", label: t("No") },
  ]
  const circlesOptions: ChipOption<CirclesRelevant>[] = [
    { value: "yes", label: t("Yes") },
    { value: "somewhat", label: t("Somewhat") },
    { value: "not_really", label: t("Not really") },
  ]
  const contactOptions: ChipOption<ExchangedContact>[] = [
    { value: "yes", label: t("Yes") },
    { value: "no", label: t("No") },
  ]
  const qualityOptions: ChipOption<AvQuality>[] = [
    { value: "good", label: t("Good") },
    { value: "minor_issues", label: t("Minor issues") },
    { value: "significant_problems", label: t("Significant problems") },
  ]
  const reportReasons: ChipOption<ReportReason>[] = [
    { value: "disrespectful", label: t("Disrespectful or aggressive behaviour") },
    { value: "inappropriate", label: t("Inappropriate or unwanted content") },
    { value: "no_show", label: t("Did not show up or disconnected without reason") },
    { value: "solicitation", label: t("Used Sondra to sell, promote, or recruit") },
    { value: "unsafe", label: t("Made me feel unsafe or uncomfortable") },
    { value: "other", label: t("Something else") },
  ]

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <Link to="/dashboard" className="font-heading text-xl">
          Sondra
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-24">
        {!meetingId || meetingQuery.isError ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <AlertCircleIcon className="size-8 text-destructive" aria-hidden />
            <p className="text-sm">{t("We couldn't load this conversation.")}</p>
            <Button render={<Link to="/dashboard" />}>
              {t("Back to dashboard")}
            </Button>
          </div>
        ) : submitted ? (
          <div className="flex min-h-[60svh] flex-col items-center justify-center gap-4 text-center">
            <h1>{t("Thank you for showing up.")}</h1>
            <p className="max-w-sm text-muted-foreground">
              {doorOpen
                ? t("Your note is held. We'll deliver it if they open the door too.")
                : t("Your feedback helps us make Sondra better.")}
            </p>
            <Button
              className="mt-2"
              variant="outline"
              render={<Link to="/dashboard" />}
            >
              {t("Back to dashboard")}
            </Button>
          </div>
        ) : (
          <>
            <section className="py-8">
              <h6 className="text-muted-foreground">
                {t("After the conversation")}
              </h6>
              <h1 className="mt-2">{t("Before you go.")}</h1>
              {meetingQuery.isLoading ? (
                <Skeleton className="mt-3 h-4 w-48" />
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  {peerName}
                  {startedAt ? ` · ${startedAt}` : ""}
                </p>
              )}
            </section>

            <Separator />

            <section className="py-8">
              <h6 className="mb-4">
                {t("Would you talk to {{name}} again?", { name: peerName })}
              </h6>
              <ChipGroup
                options={talkAgainOptions}
                value={talkAgain}
                onChange={setTalkAgain}
              />
            </section>

            <Separator />

            <section className="py-8">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>{t("Leave the door open.")}</CardTitle>
                      <CardDescription className="mt-1">
                        {doorOpen
                          ? t("The door is open. We'll let you know if they do the same.")
                          : t("Write one line about them — what you noticed, what stayed with you. We'll only share it if they open the door too.")}
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={doorOpen ? "secondary" : "outline"}
                      onClick={() => setDoorOpen((v) => !v)}
                    >
                      {doorOpen ? t("Opened") : t("Open")}
                    </Button>
                  </div>
                </CardHeader>
                {doorOpen && (
                  <CardContent>
                    <Textarea
                      value={doorNote}
                      onChange={(e) => setDoorNote(e.target.value)}
                      placeholder={t(
                        "What would you want them to know you noticed?",
                      )}
                      rows={3}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("Optional. Only delivered if they open the door too.")}
                    </p>
                  </CardContent>
                )}
              </Card>
            </section>

            <Separator />

            <section className="py-8">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>{t("Don't match me with them again.")}</CardTitle>
                      <CardDescription className="mt-1">
                        {t("We won't suggest this person as a match again. They won't be notified.")}
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={dontMatchAgain ? "secondary" : "outline"}
                      onClick={() => setDontMatchAgain((v) => !v)}
                    >
                      {dontMatchAgain ? t("Excluded") : t("Exclude")}
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            </section>

            <Separator />

            <section className="py-8">
              <h6 className="mb-4">{t("How are you feeling?")}</h6>
              <Textarea
                value={feeling}
                onChange={(e) => setFeeling(e.target.value)}
                placeholder={t("Say as much or as little as you like.")}
                rows={3}
              />
            </section>

            <Separator />

            <section className="flex flex-col gap-6 py-8">
              <div>
                <h6 className="mb-3">
                  {t("Did your shared circles feel relevant to this conversation?")}
                </h6>
                <ChipGroup
                  options={circlesOptions}
                  value={circlesRelevant}
                  onChange={setCirclesRelevant}
                />
              </div>
              <div>
                <h6 className="mb-3">
                  {t("Did you exchange personal contact details?")}
                </h6>
                <ChipGroup
                  options={contactOptions}
                  value={exchangedContact}
                  onChange={setExchangedContact}
                />
              </div>
              <div>
                <h6 className="mb-3">
                  {t("How was the video and audio quality?")}
                </h6>
                <ChipGroup
                  options={qualityOptions}
                  value={avQuality}
                  onChange={setAvQuality}
                />
              </div>
            </section>

            <Separator />

            <section className="py-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xs tracking-widest text-muted-foreground uppercase">
                    {t("For Sondra only")}
                  </CardTitle>
                  <CardDescription>
                    {t("How would you rate this match overall?")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-label={t("Rate {{n}} stars", { n })}
                        onClick={() => setMatchRating(n)}
                        className="p-1"
                      >
                        <StarIcon
                          className={cn(
                            "size-6 transition-colors",
                            n <= matchRating
                              ? "fill-primary text-primary"
                              : "text-muted-foreground/30",
                          )}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t("Not shared with anyone else.")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </section>

            <Separator />

            <section className="py-8">
              <h6 className="mb-1">
                {t("Your notes")}{" "}
                <span className="font-normal normal-case text-muted-foreground">
                  — {t("optional")}
                </span>
              </h6>
              <p className="mb-3 text-xs text-muted-foreground">
                {t("Just for you — not shared with anyone.")}
              </p>
              <Textarea
                value={privateNotes}
                onChange={(e) => setPrivateNotes(e.target.value)}
                placeholder={t(
                  "What do you want to remember from this conversation?",
                )}
                rows={3}
              />
            </section>

            <div className="flex flex-col items-start gap-4 pt-2">
              <Button
                size="lg"
                onClick={handleDone}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? t("Saving…") : t("Done")}
              </Button>

              <Dialog open={reportOpen} onOpenChange={setReportOpen}>
                <DialogTrigger
                  render={
                    <Button
                      variant="link"
                      className="px-0 text-muted-foreground"
                    />
                  }
                >
                  {t("Report an issue with this conversation")}
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("Report an issue")}</DialogTitle>
                    <DialogDescription>
                      {t("This goes only to the Sondra team. The other person won't be notified unless we investigate.")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col gap-2">
                    {reportReasons.map((opt) => (
                      <Button
                        key={opt.value}
                        type="button"
                        variant={
                          reportReason === opt.value ? "secondary" : "outline"
                        }
                        className="h-auto justify-start py-2 text-left whitespace-normal"
                        onClick={() => setReportReason(opt.value)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                  <Textarea
                    value={reportDetail}
                    onChange={(e) => setReportDetail(e.target.value)}
                    placeholder={t(
                      "Anything else you'd like us to know (optional)",
                    )}
                    rows={3}
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setReportOpen(false)}>
                      {t("Cancel")}
                    </Button>
                    <Button
                      onClick={handleSendReport}
                      disabled={!reportReason || mutation.isPending}
                    >
                      {t("Send report")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
