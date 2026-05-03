import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import en from "@/locales/en.json"
import es from "@/locales/es.json"

const supportedLocalesEnv: string | undefined =
  import.meta.env.VITE_SUPPORTED_LOCALES
const supportedLocales: readonly string[] = supportedLocalesEnv
  ? supportedLocalesEnv.split(",").map((l) => l.trim())
  : ["en"]

const localeModules: Record<string, typeof en> = { en, es }
const resources: Record<string, { translation: typeof en }> = {}

for (const locale of supportedLocales) {
  const mod = localeModules[locale]
  if (mod) {
    resources[locale] = { translation: mod }
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: [...supportedLocales],
    keySeparator: false,
    nsSeparator: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "i18nextLng",
      caches: ["localStorage"],
    },
  })

export { supportedLocales }
export default i18n
