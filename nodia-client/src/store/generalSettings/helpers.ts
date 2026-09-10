import type { ModuleContext, TranslateItem } from "./types";

/**
 * Normalizes and returns the navigation path for a module.
 * Prefers module.link if configured, otherwise maps known keys.
 */
export const getModulePath = (module: ModuleContext): string => {
  if (module.link && module.link.trim()) {
    return module.link.startsWith("/") ? module.link : `/${module.link}`;
  }
  const normalized = module.key.toLowerCase();
  if (normalized === "users" || normalized === "usuarios") return "/settings/users";
  if (normalized === "roles") return "/settings/roles";
  if (normalized === "actions" || normalized === "acciones") return "/settings/actions";
  if (normalized === "modules" || normalized === "modulos") return "/settings/modules";
  return "/";
};

/**
 * Resolves a translated label from an array of TranslateItem based on the active language.
 * Falls back to defaultKey if no translation is found.
 */
export const getTranslatedName = (
  translates: TranslateItem[] | undefined,
  defaultKey: string,
  lang: string
): string => {
  if (translates && translates.length > 0) {
    const isEn = lang.startsWith("en");
    const preferred = isEn ? "en" : "es";
    const secondary = isEn ? "es" : "en";

    const item =
      translates.find((tr) => tr.key === "key" || tr.key === "name") ||
      translates[0];

    if (item) {
      const val = item[preferred] || item[secondary];
      if (val && val.trim()) return val;
    }
  }

  return defaultKey;
};
