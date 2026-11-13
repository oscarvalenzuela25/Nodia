import type {
  AuthorizationContextResponse,
  ModuleContext,
  ModuleGroupContext,
  TranslateItem,
} from "./types";
import { BUSINESS_ROUTE } from "../../modules/business/constants/routes";
import { canonicalModuleDestination } from "../../routes/moduleDestinations";
import { NODIA_TEACHER_ROUTE } from "../../modules/teacher/constants/routes";
import { NODIA_AI_ROUTE } from "../../modules/nodiaAi/constants/routes";

export const normalizeModulePath = (path: string) => {
  const pathname = canonicalModuleDestination(path.trim()).split(/[?#]/, 1)[0];
  return `/${pathname.replace(/^\/+|\/+$/g, "")}`.toLowerCase();
};

/** Match an assigned module's destination, never a group or a path prefix. */
export const hasModuleAccess = (groups: ModuleGroupContext[], path: string) => {
  if (!Array.isArray(groups)) return false;
  const destination = normalizeModulePath(path);
  const matches = groups.flatMap(group => Array.isArray(group.modules) ? group.modules : [])
    .filter(module => normalizeModulePath(getModulePath(module)) === destination);
  // Match the server's canonical NodiaAI identity, not a renamed/lookalike
  // module pointing at its route. Ambiguous destinations never grant access.
  return matches.length === 1 && (destination !== NODIA_AI_ROUTE || matches[0].key === "nodia_ai");
};

/** Access is granted by a module or the active superadministrator context. */
export const canAccessModule = (
  context: Pick<AuthorizationContextResponse, "roles" | "modules">,
  path: string,
) =>
  (Array.isArray(context.roles) && context.roles.includes("super_admin")) ||
  hasModuleAccess(context.modules, path);

/**
 * Normalizes and returns the navigation path for a module.
 * Prefers module.link if configured, otherwise maps known keys.
 */
export const getModulePath = (module: ModuleContext): string => {
  const link = module.link?.trim();
  if (link) {
    return canonicalModuleDestination(link);
  }
  const normalized = module.key.toLowerCase();
  if (normalized === "users" || normalized === "usuarios")
    return "/users";
  if (normalized === "roles") return "/roles";
  if (normalized === "actions" || normalized === "acciones")
    return "/actions";
  if (normalized === "modules" || normalized === "modulos")
    return "/modules";
  if (normalized === "nodia_teacher") return NODIA_TEACHER_ROUTE;
  if (
    normalized === "business" ||
    normalized === "businesses" ||
    normalized === "negocios"
  )
    return BUSINESS_ROUTE;
  if (
    normalized === "ai-providers" ||
    normalized === "ai_providers" ||
    normalized === "ai-provider" ||
    normalized === "ai_provider" ||
    normalized === "proveedores_ia" ||
    normalized === "proveedores-ia"
  ) {
    return "/ai-providers";
  }
  return "/";
};

/**
 * Resolves a translated label from an array of TranslateItem based on the active language.
 * Falls back to defaultKey if no translation is found.
 */
export const getTranslatedName = (
  translates: TranslateItem[] | undefined,
  defaultKey: string,
  lang: string,
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
