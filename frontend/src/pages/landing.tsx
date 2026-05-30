import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/language-toggle"

function SectionDivider() {
  return (
    <div
      className="mx-auto h-20 w-px bg-linear-to-b from-transparent via-primary/30 to-transparent"
      aria-hidden
    />
  )
}

const sectionLabelClass =
  "mb-10 block text-[0.78rem] font-medium tracking-[0.45em] text-primary uppercase"

const steps = [
  {
    n: "1",
    title: "Tell us who you are",
    desc: "Two minutes. Your name, your languages, what brings you here.",
  },
  {
    n: "2",
    title: "Get matched",
    desc: "We pair you with someone who shares something with you. Serendipity, with a filter.",
  },
  {
    n: "3",
    title: "Show up",
    desc: "Your face. Their face. Nothing between you.",
  },
] as const

export default function LandingPage() {
  const { t } = useTranslation()

  return (
    <div className="landing-bg flex min-h-svh flex-col overflow-x-hidden text-foreground">
      <header className="flex items-center justify-between px-6 py-6 md:px-10">
        <div className="flex items-center gap-2">
          <Link to="/" className="font-heading text-[1.85rem] tracking-[0.01em]">
            Sondra
          </Link>
          <Badge
            variant="outline"
            className="text-[0.625rem] tracking-wider uppercase"
          >
            {t("Beta")}
          </Badge>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageToggle />
          <ThemeToggle />
          <Button variant="link" render={<Link to="/login" />}>
            {t("Log in")}
          </Button>
          <Button
            size="lg"
            className="landing-flicker tracking-[0.05em]"
            render={<Link to="/signup" />}
          >
            {t("Join Sondra")}
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {/* HERO */}
        <section className="flex min-h-[calc(100svh-6rem)] flex-col items-center justify-center px-6 py-16 text-center">
          <h1 className="mb-[3.2rem] max-w-5xl text-balance text-[clamp(44px,8vw,104px)] font-normal leading-[1.04] tracking-[-0.005em]">
            {t("Someone is waiting")}
            <span className="landing-accent mt-[0.15em] block font-normal">
              {t("to listen.")}
            </span>
          </h1>

          <p className="mb-[3.8rem] max-w-155 text-balance text-[1.35rem] font-light leading-[1.7] text-muted-foreground">
            {t(
              "Sondra matches you with a real person who has something in common with you.",
            )}
            <br />
            {t("No agenda. No scripts. Two faces, full attention.")}
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Button
              size="xl"
              className="landing-flicker tracking-[0.05em]"
              render={<Link to="/signup" />}
            >
              {t("Talk Now")}
            </Button>
            <Button
              size="xl"
              variant="outline"
              className="tracking-[0.05em]"
              render={<Link to="/signup" />}
            >
              {t("Join Sondra")}
            </Button>
          </div>
        </section>

        <SectionDivider />

        {/* WHAT IT IS */}
        <section className="mx-auto max-w-3xl px-6 py-24 md:py-28">
          <span className={sectionLabelClass}>{t("What it is")}</span>
          <h2 className="mb-8 text-balance text-[clamp(1.6rem,4vw,2.8rem)] font-normal leading-[1.25]">
            {t("Not chatbots. Not scrolling. Not swiping.")}
          </h2>
          <p className="max-w-2xl text-[1.25rem] font-light leading-[1.85] text-muted-foreground">
            {t(
              "A live video conversation between two people who show up with their faces and their attention. Matched by what you have in common — not by an algorithm chasing your engagement.",
            )}{" "}
            <span className="text-foreground">
              {t("The conversation is the whole point.")}
            </span>
          </p>
        </section>

        <SectionDivider />

        {/* HOW IT WORKS */}
        <section className="mx-auto max-w-3xl px-6 py-24 md:py-28">
          <span className={sectionLabelClass}>{t("How it works")}</span>
          <div className="flex flex-col gap-12">
            {steps.map((step) => (
              <div
                key={step.n}
                className="grid grid-cols-[2.5rem_1fr] items-start gap-4 md:grid-cols-[3rem_1fr] md:gap-6"
              >
                <div className="text-[2.8rem] font-light leading-none text-primary/70">
                  {step.n}
                </div>
                <div>
                  <h3 className="mb-1.5 text-[1.3rem] font-medium tracking-[0.01em]">
                    {t(step.title)}
                  </h3>
                  <p className="text-[1.1rem] font-light leading-[1.7] text-muted-foreground">
                    {t(step.desc)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <SectionDivider />

        {/* WHO IT'S FOR */}
        <section className="mx-auto max-w-3xl px-6 py-24 md:py-28">
          <span className={sectionLabelClass}>{t("Who it's for")}</span>
          <p className="max-w-2xl text-[1.3rem] font-light leading-[2] text-muted-foreground">
            {t(
              "You belong here if you feel the absence of real conversation in your daily life. If you're curious about other people's minds, not their profiles. If you're in a new city, a career shift, or tired of conversations that never go below the surface.",
            )}
          </p>
        </section>

        <SectionDivider />

        {/* CLOSE */}
        <section className="mx-auto max-w-3xl px-6 py-24 text-center md:py-32">
          <p className="text-[clamp(1.5rem,3.5vw,2.4rem)] font-light leading-[1.5]">
            {"“"}
            {t(
              "The most powerful technology for human connection has always been a conversation.",
            )}
            {"”"}
          </p>
          <p className="mx-auto mt-8 mb-12 text-[clamp(1.1rem,2.2vw,1.6rem)] font-light leading-[1.8] text-muted-foreground">
            {t("We built the scaffolding.")}
            <br />
            {t("You bring everything else.")}
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="xl"
              className="landing-flicker tracking-[0.05em]"
              render={<Link to="/signup" />}
            >
              {t("Talk Now")}
            </Button>
            <Button
              size="xl"
              variant="outline"
              className="tracking-[0.05em]"
              render={<Link to="/signup" />}
            >
              {t("Join Sondra")}
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-sm text-muted-foreground sm:flex-row md:px-10">
          <span className="font-heading text-sm tracking-tight text-foreground">
            Sondra
          </span>
          <span>{t("Real conversation, always within reach")}</span>
        </div>
      </footer>
    </div>
  )
}
