/** Explicit navigation identities. Resource API paths are deliberately unrelated. */
export const MODULE_ROUTE_MIGRATION = [
  ['/tools/nodia-ai', '/nodia-ai'],
  ['/tools/reservations', '/reservations'],
  ['/tools/finances-personal', '/finances-personal'],
  ['/tools/business', '/business'],
  ['/settings/users', '/users'],
  ['/settings/roles', '/roles'],
  ['/settings/actions', '/actions'],
  ['/settings/modules', '/modules'],
  ['/settings/ai-providers', '/ai-providers'],
  ['/general-settings/users', '/users'],
  ['/general-settings/roles', '/roles'],
  ['/general-settings/actions', '/actions'],
  ['/general-settings/modules', '/modules'],
  ['/general-settings/ai-providers', '/ai-providers'],
] as const;

/** Historical signed manifests remain byte-identical; their module identity resolves here. */
export function canonicalModuleRoute(route: string): string {
  return MODULE_ROUTE_MIGRATION.find(([source]) => source === route)?.[1] ?? route;
}

/** Projection only: never mutate a signed/persisted scope or recompute its hash. */
export function moduleRouteIncluded(routes: readonly unknown[], route: string): boolean {
  return routes.some(candidate => typeof candidate === 'string' &&
    canonicalModuleRoute(candidate) === canonicalModuleRoute(route));
}

export const canonicalModuleRoutes = (routes: readonly string[]): string[] => routes.map(canonicalModuleRoute);

/** SQL visibility needs the exact historical aliases, under the same current grant. */
export function compatibleModuleRoutes(routes: readonly string[]): string[] {
  const permitted = new Set(canonicalModuleRoutes(routes));
  return [...new Set([...routes, ...permitted, ...MODULE_ROUTE_MIGRATION
    .filter(([, destination]) => permitted.has(destination)).map(([source]) => source)])];
}

/** Preserve the historical v1 tool contract encoding while presenting canonical navigation. */
export function contractModuleRoute(route: string): string {
  const canonical = canonicalModuleRoute(route);
  return MODULE_ROUTE_MIGRATION.find(([, destination]) => destination === canonical)?.[0] ?? route;
}
