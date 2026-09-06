// Account-last registration flow: seven short survey questions answered
// before any account exists, then the account is created and the answers are
// persisted against it. Custom onboarding-family styling is intentional here
// (see the landing/onboarding exception in CLAUDE.md) — this is the
// first-time-user moment. After "Enter Sondra" the user is handed to the
// existing /onboarding ceremony (timezone / languages / circles).
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { submitRegistrationSurveySchema } from "@base-dashboard/shared"
import { useAuth } from "@/hooks/use-auth"
import { LanguageToggle } from "@/components/language-toggle"
import { submitRegistrationSurveyApi } from "@/lib/registration-surveys"
import {
  RegistrationQuestionStep,
  type RegistrationOption,
} from "@/components/onboarding/registration-question-step"
import { RegistrationInfoStep } from "@/components/onboarding/registration-info-step"
import {
  RegistrationAccountStep,
  type RegistrationAccountValues,
} from "@/components/onboarding/registration-account-step"
import { RegistrationDoneStep } from "@/components/onboarding/registration-done-step"

const OPENER = 0
const Q_INTENT = 1
const Q_AGE = 2
const Q_REAL = 3
const Q_DAYS = 4
const Q_DISTANCE = 5
const BETA = 6
const Q_CIRCLES = 7
const Q_BLOCKER = 8
const ACCOUNT = 9
const DONE = 10
const TOTAL_SCREENS = 11
const TOTAL_QUESTIONS = 7

const QUESTION_NUMBERS: Record<number, number> = {
  [Q_INTENT]: 1,
  [Q_AGE]: 2,
  [Q_REAL]: 3,
  [Q_DAYS]: 4,
  [Q_DISTANCE]: 5,
  [Q_CIRCLES]: 6,
  [Q_BLOCKER]: 7,
}

type SingleKey =
  | "intent"
  | "ageRange"
  | "realConversations"
  | "daysSpent"
  | "distanceFromHome"
  | "blocker"

interface RegistrationAnswers {
  intent: string
  ageRange: string
  realConversations: string
  daysSpent: string
  distanceFromHome: string
  circles: string[]
  blocker: string
}

const EMPTY_ANSWERS: RegistrationAnswers = {
  intent: "",
  ageRange: "",
  realConversations: "",
  daysSpent: "",
  distanceFromHome: "",
  circles: [],
  blocker: "",
}

function detectTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export default function RegisterPage() {
  const { t } = useTranslation()
  const { signup } = useAuth()
  const [screen, setScreen] = useState(OPENER)
  const [answers, setAnswers] = useState<RegistrationAnswers>(EMPTY_ANSWERS)

  function go(next: number) {
    setScreen(next)
    window.scrollTo(0, 0)
  }

  function setSingle(key: SingleKey, value: string | string[]) {
    if (typeof value !== "string") return
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  function setCircles(value: string | string[]) {
    if (!Array.isArray(value)) return
    setAnswers((prev) => ({ ...prev, circles: value }))
  }

  async function handleAccountSubmit(
    values: RegistrationAccountValues,
  ): Promise<void> {
    await signup(values.name, values.email, values.password, detectTimezone())

    const parsed = submitRegistrationSurveySchema.safeParse(answers)
    if (parsed.success) {
      try {
        await submitRegistrationSurveyApi(parsed.data)
      } catch {
        toast.error(
          t("We couldn't save your answers, but your account is ready."),
        )
      }
    }

    go(DONE)
  }

  const intentOptions: RegistrationOption[] = [
    {
      value: "curiosity",
      label: t("Curiosity"),
      reply: t(
        "Curiosity is the most durable reason there is. The people who arrive curious aren't trying to fix anything — they just want to see who's out there, and they're the ones still here months later.",
      ),
    },
    {
      value: "deeper",
      label: t("Something deeper"),
      reply: t(
        "Then here's the thing worth knowing: when strangers were asked to skip small talk entirely and go straight to something real, the conversation came out less awkward and more enjoyable than either of them predicted. Depth isn't the risk. Assuming the other person doesn't want it — that's the risk.",
      ),
      source: t(
        "Kardas, Kumar & Epley, Journal of Personality and Social Psychology, 2022",
      ),
    },
    {
      value: "new-city",
      label: t("A new city"),
      reply: t(
        "Moving costs you your weak ties — the barista, the neighbour, the person at the next desk. Those brief exchanges measurably lift mood and sense of belonging, and they're the first thing a new city takes away.",
      ),
      source: t(
        "Sandstrom & Dunn, Personality and Social Psychology Bulletin, 2014",
      ),
    },
    {
      value: "other-lives",
      label: t("Other lives"),
      reply: t(
        "That makes you rarer than you think. Most people enter a conversation planning what they'll say. The ones who enter planning to listen are the ones others ask for again.",
      ),
    },
    {
      value: "personal",
      label: t("Something personal"),
      reply: t(
        "You won't have to name it — not here, and not in a conversation. Circles exist precisely so you can be recognised without having to explain yourself first.",
      ),
    },
  ]

  const ageReply = t(
    "We ask because a conversation between people forty years apart is very different from one between people four years apart. Both are worth having — they're just not the same. Thanks for talking to a human in such a digital age.",
  )
  const ageOptions: RegistrationOption[] = [
    { value: "18-24", label: t("18–24"), reply: ageReply },
    { value: "25-34", label: t("25–34"), reply: ageReply },
    { value: "35-44", label: t("35–44"), reply: ageReply },
    { value: "45-54", label: t("45–54"), reply: ageReply },
    { value: "55-64", label: t("55–64"), reply: ageReply },
    {
      value: "65+",
      label: t("65+"),
      reply: t(
        "We ask because a conversation across a forty-year gap is a different animal from one across four. You're on the side of that gap where you've already lived through the thing the other person is standing in the middle of.",
      ),
    },
  ]

  const realOptions: RegistrationOption[] = [
    {
      value: "yes",
      label: t("Yes"),
      reply: t(
        "Then you're luckier than most. Sondra isn't trying to replace those people — it's for the conversations they can't have with you.",
      ),
    },
    {
      value: "no",
      label: t("No"),
      reply: t(
        "You have more company than it feels like — one in six people worldwide would answer the same way. And there's a good finding attached to it: people underestimate how much others like them, for a very long time. Among students sharing a dorm, the gap lasted almost the whole academic year before it closed.",
      ),
      source: t(
        "WHO Commission on Social Connection, 2025 · Boothby, Cooney, Sandstrom & Clark, Psychological Science, 2018",
      ),
    },
  ]

  const daysOptions: RegistrationOption[] = [
    {
      value: "At home",
      label: t("At home"),
      reply: t(
        "Remote work removes your weak ties without announcing it — the corridor, the lift, the person at the next desk. Those small exchanges measurably raise mood and belonging. Losing them is quiet, and it accumulates.",
      ),
      source: t(
        "Sandstrom & Dunn, Personality and Social Psychology Bulletin, 2014",
      ),
    },
    {
      value: "A bit of both",
      label: t("A bit of both"),
      reply: t(
        "Two different weeks stitched together, which usually means your appetite for company changes depending on the day. That's what the availability windows are for — you set them broadly, not by the hour.",
      ),
    },
    {
      value: "Out, with people",
      label: t("Out, with people"),
      reply: t(
        "Being around people all day isn't the same as being known by them. Some of the loneliest weeks happen in full rooms.",
      ),
    },
  ]

  const distanceOptions: RegistrationOption[] = [
    {
      value: "still-there",
      label: t("Still there"),
      reply: t(
        "Roots are an advantage most people here don't have. You're often the one who can offer steadiness rather than the one needing it.",
      ),
    },
    {
      value: "another-country",
      label: t("Another country"),
      reply: t(
        "Living abroad is a circle of its own. Most people who choose it say the hard part isn't the language — it's that nobody around you knew you before.",
      ),
    },
    {
      value: "lost-count",
      label: t("Lost count"),
      reply: t(
        "Then you already know the pattern: arriving isn't the hard part. Starting the explaining again is. Circles are our attempt to let you skip that.",
      ),
    },
  ]

  const circleOptions: RegistrationOption[] = [
    { value: "Parent", label: t("Parent") },
    { value: "Introvert", label: t("Introvert") },
    { value: "Entrepreneur", label: t("Entrepreneur") },
    { value: "Travel", label: t("Travel") },
    { value: "Books", label: t("Books") },
    { value: "Music", label: t("Music") },
    { value: "Grief", label: t("Grief") },
    { value: "Starting Over", label: t("Starting Over") },
    { value: "New to the City", label: t("New to the City") },
  ]

  const blockerOptions: RegistrationOption[] = [
    {
      value: "It'll be awkward",
      label: t("It'll be awkward"),
      reply: t(
        "Everyone predicts awkward. Across study after study of conversations with strangers, the actual experience comes out better than the forecast — the misprediction is itself the finding.",
      ),
      source: t(
        "Epley & Schroeder, Journal of Experimental Psychology: General, 2014",
      ),
    },
    {
      value: "Ending it",
      label: t("Ending it"),
      reply: t(
        'There is a Leave conversation button, and pressing it tells the other person nothing at all. Easier still: agree a rough length in the first minute — "shall we say twenty?" — and then the ending belongs to both of you instead of falling to whoever is braver.',
      ),
    },
    {
      value: "Being on camera",
      label: t("Being on camera"),
      reply: t(
        "Fair, and it's the one thing we won't compromise on — so you deserve the reason. When you hear and see a person rather than read their words, they register as more thoughtful, more capable, more human. The effect is strongest exactly when you disagree with them. That's why Sondra isn't a chat app.",
      ),
      source: t("Schroeder, Kardas & Epley, Psychological Science, 2017"),
    },
    {
      value: "Safety",
      label: t("Safety"),
      reply: t(
        "You can leave at any moment and no one is told why. No ratings, no score, no public profile. Nobody is kept: a door only stays open if both of you reach for it afterwards, separately.",
      ),
    },
    {
      value: "Time commitment",
      label: t("Time commitment"),
      reply: t(
        "You choose your own availability. You won't owe more time than you want to give.",
      ),
    },
    {
      value: "Nothing, really",
      label: t("Nothing, really"),
      reply: t(
        "Rare, and useful. You'll probably end up being somebody's easiest first conversation.",
      ),
    },
  ]

  const questionNumber = QUESTION_NUMBERS[screen]
  const counter =
    questionNumber !== undefined
      ? t("Question {{n}} of {{total}}", {
          n: questionNumber,
          total: TOTAL_QUESTIONS,
        })
      : screen === ACCOUNT
        ? t("One last thing")
        : ""
  const progress = (screen / (TOTAL_SCREENS - 1)) * 100

  return (
    <div className="onboarding-bg relative flex min-h-svh flex-col text-foreground">
      <div className="onboarding-grain" aria-hidden />

      <header className="relative z-10 mx-auto flex w-full max-w-[680px] items-center justify-between px-6 pt-8">
        <span className="onboarding-logo">Sondra</span>
        <div className="flex items-center gap-3">
          <span className="onboarding-counter">{counter}</span>
          <LanguageToggle />
        </div>
      </header>
      <div className="relative z-10 mx-auto mt-4 w-full max-w-[680px] px-6">
        <div className="onboarding-bar">
          <span className="onboarding-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <main className="relative z-10 mx-auto w-full max-w-[680px] flex-1 px-6 pb-20">
        {screen === OPENER && (
          <RegistrationInfoStep
            quote
            heading={t(
              "The most valuable connections start with a little openness and a willingness to be surprised.",
            )}
            sub={t(
              "Across twenty million people over five years, it wasn't the closest relationships that opened the most doors — it was the looser ones. Acquaintances. Friends of friends. The people not yet in your life.",
            )}
            source={t(
              "Rajkumar, Saint-Jacques, Bojinov, Brynjolfsson & Aral, Science, 2022",
            )}
            buttonLabel={t("Start")}
            fine={t("Seven short questions. Two minutes. No account needed yet.")}
            onNext={() => go(Q_INTENT)}
          />
        )}

        {screen === Q_INTENT && (
          <RegistrationQuestionStep
            counter={counter}
            heading={t("What brought you here?")}
            subline={t("Honestly. It changes who we put in front of you.")}
            options={intentOptions}
            value={answers.intent}
            onChange={(v) => setSingle("intent", v)}
            onBack={() => go(OPENER)}
            onNext={() => go(Q_AGE)}
          />
        )}

        {screen === Q_AGE && (
          <RegistrationQuestionStep
            counter={counter}
            heading={t("How old are you?")}
            subline={t("A range is enough.")}
            options={ageOptions}
            value={answers.ageRange}
            onChange={(v) => setSingle("ageRange", v)}
            onBack={() => go(Q_INTENT)}
            onNext={() => go(Q_REAL)}
          />
        )}

        {screen === Q_REAL && (
          <RegistrationQuestionStep
            counter={counter}
            heading={t(
              "Do you feel like you have real conversations in your life?",
            )}
            subline={t("The kind where you say the true thing, not the easy one.")}
            options={realOptions}
            value={answers.realConversations}
            onChange={(v) => setSingle("realConversations", v)}
            onBack={() => go(Q_AGE)}
            onNext={() => go(Q_DAYS)}
          />
        )}

        {screen === Q_DAYS && (
          <RegistrationQuestionStep
            counter={counter}
            heading={t("Where do your days happen?")}
            options={daysOptions}
            value={answers.daysSpent}
            onChange={(v) => setSingle("daysSpent", v)}
            freeText={{
              placeholder: t("Or somewhere else entirely — where?"),
              reply: t(
                "However your week is shaped, it decides how much unplanned company you get — and unplanned company is the thing almost nobody schedules and everybody misses.",
              ),
            }}
            onBack={() => go(Q_REAL)}
            onNext={() => go(Q_DISTANCE)}
          />
        )}

        {screen === Q_DISTANCE && (
          <RegistrationQuestionStep
            counter={counter}
            heading={t("How far are you from where you're from?")}
            subline={t("Distance from home changes what a conversation is for.")}
            options={distanceOptions}
            value={answers.distanceFromHome}
            onChange={(v) => setSingle("distanceFromHome", v)}
            onBack={() => go(Q_DAYS)}
            onNext={() => go(BETA)}
          />
        )}

        {screen === BETA && (
          <RegistrationInfoStep
            heading={t("Sondra is in beta, and beta is free.")}
            sub={t(
              "A few hundred people, not a few million — by choice. What you're answering decides what gets built next. No card, nothing to cancel.",
            )}
            buttonLabel={t("Next")}
            onBack={() => go(Q_DISTANCE)}
            onNext={() => go(Q_CIRCLES)}
          />
        )}

        {screen === Q_CIRCLES && (
          <RegistrationQuestionStep
            counter={counter}
            heading={t("What are your circles?")}
            subline={t(
              "Something true about your life that someone else recognises without an explanation. It's the whole match — no photos, no bios.",
            )}
            options={circleOptions}
            multi
            minSelect={3}
            value={answers.circles}
            onChange={setCircles}
            multiReply={t(
              "Three is enough to be matched. When someone appears, this is all you will see of them — the circles you share, and their availability. No photo, no bio, no swipe.",
            )}
            onBack={() => go(BETA)}
            onNext={() => go(Q_BLOCKER)}
          />
        )}

        {screen === Q_BLOCKER && (
          <RegistrationQuestionStep
            counter={counter}
            heading={t(
              "Is there something that stops you from talking to a stranger on video?",
            )}
            subline={t("Pick what fits, or write it. We read every one of these.")}
            options={blockerOptions}
            value={answers.blocker}
            onChange={(v) => setSingle("blocker", v)}
            freeText={{
              placeholder: t("Or say it in your own words"),
              reply: t(
                "Thank you — we read every one of these, and yours goes straight to the people building Sondra.",
              ),
            }}
            onBack={() => go(Q_CIRCLES)}
            onNext={() => go(ACCOUNT)}
          />
        )}

        {screen === ACCOUNT && (
          <RegistrationAccountStep
            onSubmit={handleAccountSubmit}
            onBack={() => go(Q_BLOCKER)}
          />
        )}

        {screen === DONE && <RegistrationDoneStep />}
      </main>
    </div>
  )
}
