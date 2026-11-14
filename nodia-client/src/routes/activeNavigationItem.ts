import { canonicalModuleDestination } from "./moduleDestinations";

const navigationPath = (path: string | undefined): string | null => {
  if (typeof path !== "string") return null;
  const value = path.trim();
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return canonicalModuleDestination(value).split(/[?#]/, 1)[0].toLowerCase();
};

/** Presentation only: descendant highlighting never grants module access. */
export function activeNavigationItem<T extends { path?: string }>(pathname: string, items: readonly T[]): T | undefined {
  const current = navigationPath(pathname);
  if (!current) return undefined;
  let active: T | undefined;
  let longest = -1;
  for (const item of items) {
    const destination = navigationPath(item.path);
    if (!destination || destination.length <= longest) continue;
    const matches = current === destination || destination !== "/" && current.startsWith(`${destination}/`);
    if (matches) { active = item; longest = destination.length; }
  }
  return active;
}
