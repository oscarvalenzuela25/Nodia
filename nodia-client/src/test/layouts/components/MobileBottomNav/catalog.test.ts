import { expect, it } from "vitest";
import { buildShortcutCatalog } from "../../../../layouts/components/MobileBottomNav/catalog";
import { groups } from "./fixtures";
it("resolves names and destinations from the current authorized context", () => {
  expect(buildShortcutCatalog(groups, "en")[0]).toMatchObject({ label: "Reservations", path: "/tools/reservations", reference: { groupKey: "tools", moduleKey: "reservations" } });
  expect(buildShortcutCatalog([], "es")).toEqual([]);
});
it("excludes home, unknown paths, external links and ambiguous identities", () => {
  const modules = [
    { key: "home", link: "/", translates: [] }, { key: "unknown", translates: [] },
    { key: "external", link: "https://external.invalid", translates: [] },
    { key: "unregistered", link: "/tools/new", translates: [] }, ...groups[0].modules, groups[0].modules[0],
  ];
  expect(buildShortcutCatalog([{ ...groups[0], modules }], "es").map(option => option.reference.moduleKey)).toEqual(["finances"]);
});
