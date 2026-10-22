import { describe, expect, it } from "vitest";
import { formatReportDecimal, nodiaAiReportSchema } from "../../../../modules/nodiaAi/infrastructure/reportSchemas";
import { report } from "./reportFixtures";

describe("NodiaAI report wire validation and exact values", () => {
  it("accepts an exact partial report without converting unknown data to zero", () => {
    const result = nodiaAiReportSchema.parse(report);
    expect(result.source_results[0].rows).toEqual([[null, "0"], ["Food", "90071992547409930"]]);
    expect(result.source_results[0].totals.total).toBe("90071992547409930");
  });
  it("accepts entirely unavailable sources as unknown, without manufacturing an empty report", () => {
    const result = nodiaAiReportSchema.parse({ ...report, source_results: [], provenance: [], columns: [], rows: [], group_page_complete: true, next_cursor: null });
    expect(result.status).toBe("partial");
    expect(result.source_results).toEqual([]);
  });
  it.each([
    { ...report, extra: true },
    { ...report, status: "ok" },
    { ...report, rows: [[1, 2]] },
    { ...report, next_cursor: null },
    { ...report, source_results: [{ ...report.source_results[0], totals: { invented: "3" } }] },
    { ...report, source_results: [{ ...report.source_results[0], rows: [["Food", Number.MAX_SAFE_INTEGER + 1]] }] },
    { ...report, source_results: [{ ...report.source_results[0], status: "empty" }] },
    { ...report, provenance: [] },
    { ...report, source_errors: [{ ...report.source_errors[0], source_alias: "owner" }] },
  ])("rejects an incompatible or internally inconsistent report", input => {
    expect(nodiaAiReportSchema.safeParse(input).success).toBe(false);
  });
  it("formats arbitrary precision, fractions, zero and negative fractional zero without Number", () => {
    expect(formatReportDecimal("90071992547409930.1200", "en")).toBe("90,071,992,547,409,930.1200");
    expect(formatReportDecimal("-0.10", "es")).toBe("-0,10");
    expect(formatReportDecimal("0", "en")).toBe("0");
    expect(formatReportDecimal("-1000.01", "en")).toBe("-1,000.01");
  });
});
