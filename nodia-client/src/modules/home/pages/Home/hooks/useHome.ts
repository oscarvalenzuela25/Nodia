import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { LanguageCode, LanguageOption } from "../types";

const useHome = () => {
  const { t, i18n } = useTranslation();
  const [count, setCount] = useState(0);
  const currentLanguage = i18n.resolvedLanguage ?? i18n.language;

  const languageOptions: readonly LanguageOption[] = [
    { code: "es", shortLabel: "ES", label: t("translate:es") },
    { code: "en", shortLabel: "EN", label: t("translate:en") },
  ];

  const handleIncrement = () => {
    setCount((currentCount) => currentCount + 1);
  };

  const handleLanguageChange = (language: LanguageCode) => {
    void i18n.changeLanguage(language);
  };

  return {
    count,
    currentLanguage,
    handleIncrement,
    handleLanguageChange,
    languageOptions,
    t,
  };
};

export default useHome;
