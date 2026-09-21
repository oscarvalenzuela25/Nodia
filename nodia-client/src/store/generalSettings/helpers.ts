import type { ModuleContext, ModuleGroupContext, TranslateItem } from "./types";

const normalizeModulePath = (path: string) => {
  const pathname = path.trim().split(/[?#]/, 1)[0];
  return `/${pathname.replace(/^\/+|\/+$/g, "")}`.toLowerCase();
};

/** Match an assigned module's destination, never a group or a path prefix. */
export const hasModuleAccess = (groups: ModuleGroupContext[], path: string) =>
  Array.isArray(groups) && groups.some((group) => Array.isArray(group.modules) && group.modules.some((module) =>
    normalizeModulePath(getModulePath(module)) === normalizeModulePath(path)
  ));

/**
 * Normalizes and returns the navigation path for a module.
 * Prefers module.link if configured, otherwise maps known keys.
 */
export const getModulePath = (module: ModuleContext): string => {
  const link = module.link?.trim();
  if (link) {
    return link.startsWith("/") ? link : `/${link}`;
  }
  const normalized = module.key.toLowerCase();
  if (normalized === "users" || normalized === "usuarios") return "/settings/users";
  if (normalized === "roles") return "/settings/roles";
  if (normalized === "actions" || normalized === "acciones") return "/settings/actions";
  if (normalized === "modules" || normalized === "modulos") return "/settings/modules";
  if (normalized === "business" || normalized === "businesses" || normalized === "negocios") return "/business";
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
