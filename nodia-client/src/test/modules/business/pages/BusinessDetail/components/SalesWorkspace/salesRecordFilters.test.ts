import { describe, expect, it } from "vitest";
import { emptySalesRecordFilters, isSalesRecordStatus, salesRecordFilterParams } from "../../../../../../../modules/business/pages/BusinessDetail/components/SalesWorkspace/salesRecordFilters";

describe("sales record filters", () => {
  it("omits unset predicates and retains each real commercial status, including history", () => {
    expect(salesRecordFilterParams(emptySalesRecordFilters())).toEqual({});
    for (const status of ["draft", "completed", "cancelled", "discarded"] as const) expect(salesRecordFilterParams({ ...emptySalesRecordFilters(), status })).toEqual({ status });
    expect(isSalesRecordStatus("active")).toBe(false); expect(isSalesRecordStatus(null)).toBe(false);
  });
  it("converts an inclusive October into the exact Santiago half-open HTTP range", () => {
    expect(salesRecordFilterParams({ status: "completed", from: "2026-10-01", through: "2026-10-31" })).toEqual({ status: "completed", from: "2026-10-01T03:00:00Z", to_exclusive: "2026-11-01T03:00:00Z" });
  });
  it("uses civil days across the Santiago DST transition instead of adding fixed 24-hour periods", () => {
    const range = salesRecordFilterParams({ status: null, from: "2026-09-05", through: "2026-09-06" });
    expect(Date.parse(range.to_exclusive!) - Date.parse(range.from!)).toBe(47 * 60 * 60 * 1000);
  });
  it.each([
    ["2026-10-01", ""], ["", "2026-10-31"], ["2026-10-02", "2026-10-01"],
    ["2026-02-29", "2026-03-01"], ["2026-10-01T00:00:00Z", "2026-10-31"], ["2026-1-1", "2026-01-31"],
  ])("rejects incomplete, impossible or non-civil ranges %s / %s", (from, through) => {
    expect(() => salesRecordFilterParams({ status: null, from, through })).toThrow();
  });
});
