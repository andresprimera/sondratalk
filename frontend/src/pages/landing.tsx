import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Link } from "react-router"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/language-toggle"

export default function LandingPage() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-6 md:px-10">
        <Link
          to="/"
          className="font-heading text-2xl tracking-tight"
        >
          Sondra
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageToggle />
          <ThemeToggle />
          <Button variant="ghost" size="sm" render={<Link to="/login" />}>
            {t("Log in")}
          </Button>
          <Button size="sm" render={<Link to="/signup" />}>
            {t("Join")}
          </Button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-16 md:py-24">
        <section className="flex max-w-2xl flex-col items-center gap-8 text-center">
          <h1 className="text-balance font-heading text-4xl font-normal leading-[1.1] tracking-tight md:text-6xl">
            {t("Real human conversation, always within reach")}
          </h1>

          <p className="font-heading text-xl italic text-secondary md:text-2xl">
            {t("Someone is waiting to listen.")}
          </p>

          <p className="max-w-xl text-balance text-base leading-relaxed text-muted-foreground md:text-lg">
            {t("No chatbot. No hold music. No 'your call is important to us.' Just a real person, present with you.")}
          </p>

          <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
            <Button size="lg" render={<Link to="/signup" />}>
              {t("Talk Now")}
            </Button>
            <Button size="lg" variant="outline" render={<Link to="/signup" />}>
              {t("Join Sondra")}
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-muted-foreground md:px-10">
          <span className="font-heading text-sm tracking-tight text-foreground">
            Sondra
          </span>
          <span>© {new Date().getFullYear()} Sondra</span>
        </div>
      </footer>
    </div>
  )
}
