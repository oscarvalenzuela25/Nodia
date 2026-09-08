export interface EntityWithTranslates {
  id?: string;
  key?: string;
  name?: string | null;
  nameTranslations?: { es?: string; en?: string };
  translates?: Array<{ key: string; es?: string; en?: string }>;
}

export function formatEntityLabel(
  entityOrKey: EntityWithTranslates | string | undefined | null,
  lang: string = "es",
  fallbackTranslate?: (key: string) => string | null
): string {
  if (!entityOrKey) return "";
  if (typeof entityOrKey === "string") {
    const key = entityOrKey;
    const translated = fallbackTranslate?.(key);
    return translated && translated !== key ? `${translated} (${key})` : key;
  }

  const key = entityOrKey.key ?? "";
  if (!key) return entityOrKey.name ?? "";

  const altLang = lang.startsWith("en") ? "es" : "en";
  const currentLang = lang.startsWith("en") ? "en" : "es";

  // 1. First look up translate in entity's translates array
  const keyTrans =
    entityOrKey.translates?.find((tr) => tr.key === "key") ||
    entityOrKey.translates?.find((tr) => tr.key === "name");
  let translated = keyTrans?.[currentLang] || keyTrans?.[altLang];

  // 2. Look up nameTranslations or name property
  if (!translated) {
    translated =
      entityOrKey.nameTranslations?.[currentLang] ||
      entityOrKey.nameTranslations?.[altLang] ||
      (entityOrKey.name && entityOrKey.name !== key
        ? entityOrKey.name
        : undefined);
  }

  // 3. Fallback to i18n lookup
  if (!translated && fallbackTranslate) {
    translated = fallbackTranslate(key) ?? undefined;
  }

  return translated && translated !== key ? `${translated} (${key})` : key;
}
