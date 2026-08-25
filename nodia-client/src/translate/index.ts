import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// es
import authEs from "./es/auth.json";
import coreEs from "./es/core.json";
import homeEs from "./es/home.json";
import translateEs from "./es/translate.json";
import layoutEs from "./es/layout.json";

// en
import authEn from "./en/auth.json";
import coreEn from "./en/core.json";
import homeEn from "./en/home.json";
import translateEn from "./en/translate.json";
import layoutEn from "./en/layout.json";

export const SUPPORTED_LANGUAGES = ["es", "en"] as const;
export const DEFAULT_LANGUAGE = "es";
const LANGUAGE_STORAGE_KEY = "app_language";

type Language = (typeof SUPPORTED_LANGUAGES)[number];

const isSupportedLanguage = (language: string): language is Language => {
  return SUPPORTED_LANGUAGES.includes(language as Language);
};

const normalizeLanguage = (language: string): Language => {
  const baseLanguage = language.toLowerCase().split("-")[0];

  if (isSupportedLanguage(baseLanguage)) {
    return baseLanguage;
  }

  return DEFAULT_LANGUAGE;
};

const getInitialLanguage = (): Language => {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (savedLanguage) {
    return normalizeLanguage(savedLanguage);
  }

  return normalizeLanguage(window.navigator.language);
};

const resources = {
  es: {
    auth: authEs,
    core: coreEs,
    home: homeEs,
    translate: translateEs,
    layout: layoutEs,
  },
  en: {
    auth: authEn,
    core: coreEn,
    home: homeEn,
    translate: translateEn,
    layout: layoutEn,
  },
};

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    ns: ["auth", "core", "home", "translate", "layout"],
    defaultNS: "home",
    interpolation: {
      escapeValue: false,
    },
  });

if (typeof window !== "undefined") {
  i18n.on("languageChanged", (language) => {
    window.localStorage.setItem(
      LANGUAGE_STORAGE_KEY,
      normalizeLanguage(language)
    );
  });
}

export default i18n;
