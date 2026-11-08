import { describe, expect, it } from "vitest";
import { startsModuleGroup } from "../../../../../modules/generalSettings/pages/Modules/moduleGrouping";

describe("module group boundaries on a page", () => {
  it("repeats a heading at page start and when the parent changes", () => {
    const row = { id: "9007199254740993", key: "first", module_group_id: "9007199254740992" };
    expect(startsModuleGroup(row)).toBe(true);
    expect(startsModuleGroup({ ...row, id: "other" }, row)).toBe(false);
    expect(startsModuleGroup({ ...row, module_group_id: "9007199254740993" }, row)).toBe(true);
  });

  it("does not merge legacy records whose parent is unknown", () => {
    expect(startsModuleGroup({ id: "1", key: "first" }, { id: "2", key: "second" })).toBe(true);
  });

  it("uses the relation identity when the flat parent id is absent", () => {
    const parent = { id: "42", key: "group" };
    expect(startsModuleGroup({ id: "1", key: "first", module_group: parent }, {
      id: "2", key: "second", module_group_id: "42",
    })).toBe(false);
  });
});
