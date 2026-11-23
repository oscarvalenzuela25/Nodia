import { describe, expect, it, vi } from "vitest";
import {
  cashFilterCriteria,
  defaultCashFilters,
  validCashFilterPeriod,
  validCashSearch,
} from "../../../../../../../modules/business/pages/BusinessDetail/components/CashTab/cashFilters";

describe("Cash list filters", () => {
  it.each([
    ["2024-02-29", "2024-02-01", "2024-02-29"],
    ["2025-02-14", "2025-02-01", "2025-02-28"],
    ["2026-04-04", "2026-04-01", "2026-04-30"],
    ["2026-12-31", "2026-12-01", "2026-12-31"],
  ])("defaults to the inclusive civil month and active entries on %s", (today, from, to) => {
    expect(cashFilterCriteria(defaultCashFilters(today))).toEqual({
      from, to, active: true, categoryId: undefined,
    });
  });

  it("changes the default month at midnight in Santiago", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-07-01T03:59:59Z"));
      expect(defaultCashFilters()).toMatchObject({ from: "2026-06-01", to: "2026-06-30" });
      vi.setSystemTime(new Date("2026-07-01T04:00:00Z"));
      expect(defaultCashFilters()).toMatchObject({ from: "2026-07-01", to: "2026-07-31" });
    } finally {
      vi.useRealTimers();
    }
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
