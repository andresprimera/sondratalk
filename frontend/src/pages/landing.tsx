import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Link } from "react-router"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/language-toggle"

export default function LandingPage() {
  const { t } = useTranslation()

  return (
    <div className="landing-bg flex min-h-svh flex-col text-foreground">
      <header className="flex items-center justify-between px-6 py-6 md:px-10">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="font-heading text-[1.85rem] tracking-[0.01em]"
          >
            Sondra
          </Link>
          <Badge variant="outline" className="text-[0.625rem] tracking-wider uppercase">
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
            {t("Join")}
          </Button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-16 md:py-24">
        <section className="flex max-w-5xl flex-col items-center text-center">
          <h6 className="mb-18 text-[0.88rem] font-normal tracking-[0.45em]">
            {t("Real human conversation, always within reach")}
          </h6>

          <h1 className="mb-[3.2rem] text-balance text-[clamp(44px,7vw,104px)] font-normal leading-[1.04] tracking-[-0.005em]">
            {t("Someone is waiting")}
            <em className="landing-accent mt-[0.15em] block text-[0.75em] font-normal">
              {t("to listen.")}
            </em>
          </h1>

          <p className="mb-[3.8rem] max-w-155 text-balance text-[1.35rem] font-light leading-[1.7] text-muted-foreground">
            {t("No chatbot. No hold music. No 'your call is important to us.'")}
            <br />
            <span className="mt-2 block text-[20px] font-normal text-foreground">
              {t("Just a real person, present with you.")}
            </span>
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
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-sm text-muted-foreground md:px-10">
          <span className="font-heading text-sm tracking-tight text-foreground">
            Sondra
          </span>
          <span>© {new Date().getFullYear()} Sondra</span>
        </div>
      </footer>
    </div>
  )
}
