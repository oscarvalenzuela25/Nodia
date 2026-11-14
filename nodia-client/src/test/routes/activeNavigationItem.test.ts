import { describe, expect, it } from "vitest";
import { activeNavigationItem } from "../../routes/activeNavigationItem";
import { canAccessModule } from "../../store/generalSettings/helpers";

const home = { key: "home", path: "/" };
const teacher = { key: "nodia_teacher", path: "/nodia-teacher" };
const business = { key: "businesses", path: "/business" };
const reports = { key: "reports", path: "/business/reports" };

describe("active navigation destination", () => {
  it("keeps the parent module active throughout its descendant routes", () => {
    const items = [home, teacher, business];
    expect(activeNavigationItem("/nodia-teacher/new", items)).toBe(teacher);
    expect(activeNavigationItem("/nodia-teacher/session-id/material", items)).toBe(teacher);
    expect(activeNavigationItem("/business/business-id/products", items)).toBe(business);
    expect(activeNavigationItem("/", items)).toBe(home);
    expect(activeNavigationItem("/unregistered", items)).toBeUndefined();
  });

  it("requires a segment boundary and chooses the most specific available destination", () => {
    const items = [home, business, reports];
    expect(activeNavigationItem("/businesses/42", items)).toBeUndefined();
    expect(activeNavigationItem("/business-reports", items)).toBeUndefined();
    expect(activeNavigationItem("/business/reports/monthly", items)).toBe(reports);
    expect(activeNavigationItem("/business/reports/monthly", [reports, home, business])).toBe(reports);
    expect(activeNavigationItem("/business/another-child", items)).toBe(business);
  });

  it("normalizes canonical destinations, trailing slash, case and URL suffixes without arbitrary prefix stripping", () => {
    const legacyUsers = { path: "/settings/users/?tab=active#list" };
    expect(activeNavigationItem("/USERS/user-id/?tab=edit#form", [home, legacyUsers])).toBe(legacyUsers);
    expect(activeNavigationItem("/nodia-teacher/?tab=plans", [teacher])).toBe(teacher);
    expect(activeNavigationItem("/tools/nodia-teacher/new", [teacher])).toBeUndefined();
    expect(activeNavigationItem("/users", [{ path: "//example.com/users" }, { path: "https://example.com/users" }, {}])).toBeUndefined();
    expect(activeNavigationItem("", [home])).toBeUndefined();
  });

  it("ignores renamed or moved groups and does not turn a highlighted ancestor into access", () => {
    const before = { ...teacher, group: "studies", label: "Teacher" };
    const after = { ...teacher, group: "renamed-group", label: "Renamed module" };
    expect(activeNavigationItem("/nodia-teacher/new", [before])).toBe(before);
    expect(activeNavigationItem("/nodia-teacher/new", [after])).toBe(after);
    const context = { roles: [], modules: [{ module_group_key: "renamed-group", translates: [],
      modules: [{ key: "nodia_teacher", link: teacher.path, translates: [] }] }] };
    expect(canAccessModule(context, "/nodia-teacher")).toBe(true);
    expect(canAccessModule(context, "/nodia-teacher/new")).toBe(false);
  });
});
