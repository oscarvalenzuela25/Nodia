import type { ModuleGroupContext } from "../../../../store/generalSettings/types";
export const groups: ModuleGroupContext[] = [{ module_group_key: "tools", translates: [], modules: [
  { key: "reservations", link: "/tools/reservations", translates: [{ key: "key", es: "Reservas", en: "Reservations" }] },
  { key: "finances", link: "/finances/personal", translates: [{ key: "key", es: "Finanzas", en: "Finances" }] },
] }];
export const reference = { groupKey: "tools", moduleKey: "reservations" };
