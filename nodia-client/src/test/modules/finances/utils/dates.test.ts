import { describe, expect, it } from "vitest";
import {
  financePeriod,
  formatFinanceDate,
} from "../../../../modules/finances/utils/dates";

describe("finance Santiago periods", () => {
  it("leaves absent calendar bounds omitted", () => {
    expect(financePeriod("", "")).toEqual({});
    expect(financePeriod("2026-10-04", "")).toEqual({
      created_at_gteq: "2026-10-04T03:00:00.000Z",
    });
    expect(financePeriod("", "2026-10-04")).toEqual({
      created_at_lt: "2026-10-05T03:00:00.000Z",
    });
  });

  it("includes the full end day and crosses month/year without using host midnight", () => {
    expect(financePeriod("2026-12-31", "2027-01-01")).toEqual({
      created_at_gteq: "2026-12-31T03:00:00.000Z",
      created_at_lt: "2027-01-02T03:00:00.000Z",
    });
    expect(financePeriod("2024-02-29", "2024-02-29")).toEqual({
      created_at_gteq: "2024-02-29T03:00:00.000Z",
      created_at_lt: "2024-03-01T03:00:00.000Z",
    });
  });

  it("starts the spring DST date at its first actual local instant when midnight does not exist", () => {
    const period = financePeriod("2026-09-06", "2026-09-06");
    expect(period).toEqual({
      created_at_gteq: "2026-09-06T04:00:00.000Z",
      created_at_lt: "2026-09-07T03:00:00.000Z",
    });
    expect(
      Date.parse(period.created_at_lt!) - Date.parse(period.created_at_gteq!),
    ).toBe(23 * 3600000);
    const first = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(period.created_at_gteq!));
    expect(first).toBe("01");
  });

  it("includes both repeated late-night hours in the autumn 25-hour day", () => {
    const period = financePeriod("2026-04-04", "2026-04-04");
    expect(period).toEqual({
      created_at_gteq: "2026-04-04T03:00:00.000Z",
      created_at_lt: "2026-04-05T04:00:00.000Z",
    });
    expect(
      Date.parse(period.created_at_lt!) - Date.parse(period.created_at_gteq!),
    ).toBe(25 * 3600000);
  });

  it("creates adjacent, gap-free and nonoverlapping daily bounds across DST", () => {
    const before = financePeriod("2026-09-05", "2026-09-05");
    const transition = financePeriod("2026-09-06", "2026-09-06");
    const after = financePeriod("2026-09-07", "2026-09-07");
    expect(before.created_at_lt).toBe(transition.created_at_gteq);
    expect(transition.created_at_lt).toBe(after.created_at_gteq);
  });

  it.each([
    "2026-02-30",
    "2025-02-29",
    "2026-13-01",
    "2026-01-00",
    "2026-1-1",
    "04/10/2026",
    "2026-10-04T00:00:00Z",
  ])("rejects an invalid calendar date: %s", (day) => {
    expect(() => financePeriod(day, "")).toThrow("finance:invalid_period");
    expect(() => financePeriod("", day)).toThrow("finance:invalid_period");
  });

  it("rejects a reversed period", () => {
    expect(() => financePeriod("2026-10-05", "2026-10-04")).toThrow(
      "finance:invalid_period",
    );
  });

  it("formats timestamps using Santiago in both languages", () => {
    const value = "2026-10-04T01:30:00.000Z";
    expect(formatFinanceDate(value, "es")).toBe(
      new Intl.DateTimeFormat("es-CL", {
        timeZone: "America/Santiago",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value)),
    );
    expect(formatFinanceDate(value, "en")).toBe(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Santiago",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value)),
    );
    expect(formatFinanceDate(value, "en")).toContain("Oct 3, 2026");
  });
});
