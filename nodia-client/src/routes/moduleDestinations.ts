import { BUSINESS_ROUTE } from "../modules/business/constants/routes";
import { NODIA_AI_ROUTE } from "../modules/nodiaAi/constants/routes";
import { PERSONAL_FINANCE_ROUTE } from "../modules/finances/constants/routes";
import { RENTAL_RESERVATIONS_ROUTE } from "../modules/rentals/constants/routes";

/** Navigation destinations are resource identities, independent of menu groups. */
export const ADMIN_ROUTES = {
  users: "/users",
  roles: "/roles",
  actions: "/actions",
  modules: "/modules",
  aiProviders: "/ai-providers",
} as const;

/** Explicit compatibility map: never strip an arbitrary group/path prefix. */
export const LEGACY_MODULE_DESTINATIONS: Readonly<Record<string, string>> = {
  "/tools/business": BUSINESS_ROUTE,
  "/tools/nodia-ai": NODIA_AI_ROUTE,
  "/tools/finances-personal": PERSONAL_FINANCE_ROUTE,
  "/tools/reservations": RENTAL_RESERVATIONS_ROUTE,
  "/settings/users": ADMIN_ROUTES.users,
  "/settings/roles": ADMIN_ROUTES.roles,
  "/settings/actions": ADMIN_ROUTES.actions,
  "/settings/modules": ADMIN_ROUTES.modules,
  "/settings/ai-providers": ADMIN_ROUTES.aiProviders,
  "/general-settings/users": ADMIN_ROUTES.users,
  "/general-settings/roles": ADMIN_ROUTES.roles,
  "/general-settings/actions": ADMIN_ROUTES.actions,
  "/general-settings/modules": ADMIN_ROUTES.modules,
  "/general-settings/ai-providers": ADMIN_ROUTES.aiProviders,
};

export function canonicalModuleDestination(path: string): string {
  const suffixAt = path.search(/[?#]/);
  const pathname = suffixAt < 0 ? path : path.slice(0, suffixAt);
  const suffix = suffixAt < 0 ? "" : path.slice(suffixAt);
  const normalized = `/${pathname.trim().replace(/^\/+|\/+$/g, "")}`;
  return `${LEGACY_MODULE_DESTINATIONS[normalized.toLowerCase()] ?? normalized}${suffix}`;
}
