import { APP_AVAILABLE_ROUTES } from "../../../routes/navigationOptions";
import { getModulePath, getTranslatedName } from "../../../store/generalSettings/helpers";
import type { ModuleGroupContext } from "../../../store/generalSettings/types";
import { shortcutIdentity } from "../../../store/mobileNavigationStore";
import type { ShortcutOption } from "./types";

export const buildShortcutCatalog = (groups: ModuleGroupContext[], language: string): ShortcutOption[] => {
  const allowedPaths = new Set(APP_AVAILABLE_ROUTES.filter(route => route.value !== "/").map(route => route.value));
  const catalog = groups.flatMap(group => group.modules.flatMap(module => {
    const path = getModulePath(module);
    if (!allowedPaths.has(path)) return [];
    const reference = { groupKey: group.module_group_key, moduleKey: module.key };
    return [{ reference, identity: shortcutIdentity(reference), path, label: getTranslatedName(module.translates, module.key, language), icon: module.icon }];
  }));
  // Ambiguous identities cannot be resolved reliably from a saved reference.
  const counts = new Map<string, number>();
  for (const option of catalog) counts.set(option.identity, (counts.get(option.identity) ?? 0) + 1);
  return catalog.filter(option => counts.get(option.identity) === 1);
};
