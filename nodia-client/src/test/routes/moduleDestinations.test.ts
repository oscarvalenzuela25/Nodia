import { describe, expect, it } from "vitest";
import { canonicalModuleDestination, LEGACY_MODULE_DESTINATIONS } from "../../routes/moduleDestinations";
import { APP_AVAILABLE_ROUTES } from "../../routes/navigationOptions";
import { canAccessModule, getModulePath } from "../../store/generalSettings/helpers";
import { shortcutIdentity } from "../../store/mobileNavigationStore";
import { buildShortcutCatalog } from "../../layouts/components/MobileBottomNav/catalog";
import type { AuthorizationContextResponse } from "../../store/generalSettings/types";

describe("stable module destinations", () => {
  it("registers each destination once without menu prefixes", () => {
    const paths = APP_AVAILABLE_ROUTES.map(route => route.value);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain("/nodia-teacher");
    expect(paths.every(path => !/^\/(tools|settings|general-settings)\//.test(path))).toBe(true);
    for (const destination of Object.values(LEGACY_MODULE_DESTINATIONS)) expect(paths).toContain(destination);
  });

  it("maps only enumerated legacy resource identities", () => {
    expect(canonicalModuleDestination("/settings/users?tab=active#list")).toBe("/users?tab=active#list");
    expect(canonicalModuleDestination("general-settings/ai-providers/")).toBe("/ai-providers");
    expect(canonicalModuleDestination("/tools/unregistered")).toBe("/tools/unregistered");
    expect(canonicalModuleDestination("/settings/users/other")).toBe("/settings/users/other");
  });

  it("preserves destination, authority and saved mobile identity after group rename/move", () => {
    const module = { key: "nodia_teacher", link: "/nodia-teacher", translates: [] };
    const before = { module_group_key: "studies", translates: [], modules: [module] };
    const after = { module_group_key: "renamed-group", translates: [], modules: [module] };
    const context = (group: typeof before): Pick<AuthorizationContextResponse, "roles" | "modules"> => ({ roles: [], modules: [group] });
    expect(getModulePath(module)).toBe("/nodia-teacher");
    expect(canAccessModule(context(before), "/nodia-teacher")).toBe(true);
    expect(canAccessModule(context(after), "/nodia-teacher")).toBe(true);
    expect(canAccessModule(context(after), "/users")).toBe(false);
    const oldShortcut = buildShortcutCatalog([before], "es")[0];
    const movedShortcut = buildShortcutCatalog([after], "es")[0];
    expect(movedShortcut.identity).toBe(shortcutIdentity(oldShortcut.reference));
    expect(movedShortcut.path).toBe(oldShortcut.path);
  });

  it("uses canonical links from stale context without granting another resource or its children", () => {
    const context = { roles: [], modules: [{ module_group_key: "arbitrary", translates: [], modules: [{ key: "renamed", link: "/settings/users", translates: [] }] }] };
    expect(canAccessModule(context, "/users")).toBe(true);
    expect(canAccessModule(context, "/settings/users")).toBe(true);
    expect(canAccessModule(context, "/users/42")).toBe(false);
    expect(canAccessModule(context, "/roles")).toBe(false);
    expect(canAccessModule({ roles: [], modules: [] }, "/users")).toBe(false);
    expect(canAccessModule({ roles: [], modules: [{ ...context.modules[0], modules: [
      ...context.modules[0].modules, { key: "duplicate", link: "/users", translates: [] },
    ] }] }, "/users")).toBe(false);
  });
});
