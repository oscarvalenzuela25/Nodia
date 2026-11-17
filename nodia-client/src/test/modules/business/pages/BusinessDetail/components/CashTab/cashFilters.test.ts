import { describe, expect, it } from "vitest";
import {
  cashFilterCriteria,
  defaultCashFilters,
  validCashFilterPeriod,
  validCashSearch,
} from "../../../../../../../modules/business/pages/BusinessDetail/components/CashTab/cashFilters";

describe("Cash list filters", () => {
  it("starts from today's inclusive civil range and active entries", () => {
    expect(cashFilterCriteria(defaultCashFilters("2024-02-29"))).toEqual({
      from: "2024-02-29", to: "2024-02-29", active: true, categoryId: undefined,
    });
  });

  it("keeps inactive as false and all as omitted without dropping category or another bound", () => {
    const filters = {
      ...defaultCashFilters("2024-02-29"),
      category: { id: "9223372036854775807", name: "Caja" },
      from: "",
    };
    expect(cashFilterCriteria({ ...filters, activity: "inactive" })).toEqual({
      from: undefined, to: "2024-02-29", active: false, categoryId: "9223372036854775807",
    });
    expect(cashFilterCriteria({ ...filters, activity: "all" }).active).toBeUndefined();
  });

  it.each([
    ["", "", true],
    ["0001-01-01", "", true],
    ["", "9999-12-31", true],
    ["2024-02-29", "2024-02-29", true],
    ["2025-02-29", "", false],
    ["2024-03-01", "2024-02-29", false],
    ["", "2024-02", false],
    ["0000-12-31", "", false],
  ])("validates range %j through %j", (from, to, expected) => {
    expect(validCashFilterPeriod({ from, to })).toBe(expected);
  });

  it("limits a literal query by trimmed Unicode code points and rejects unsupported text", () => {
    expect(validCashSearch("mal,ta_100%!")).toBe(true);
    expect(validCashSearch(`\u0085${"💰".repeat(255)}\u00a0`)).toBe(true);
    expect(validCashSearch("💰".repeat(256))).toBe(false);
    expect(validCashSearch("\u0000")).toBe(false);
    expect(validCashSearch("\uD800")).toBe(false);
  });
});
