import { describe, expect, it } from "vitest";
import { reviewDueDate } from "../../../../modules/teacher/infrastructure/reviewPresentation";
describe("stored review calendar presentation", () => {
  it("uses the stored IANA zone even when the viewer has another timezone", () => {
    const instant = "2026-11-11T15:00:00Z";
    expect(reviewDueDate(instant, "America/Santiago", "en")).toBe(new Intl.DateTimeFormat("en", { timeZone: "America/Santiago", dateStyle: "medium", timeStyle: "short" }).format(new Date(instant)));
    expect(reviewDueDate(instant, "America/Santiago", "en")).not.toBe(reviewDueDate(instant, "Asia/Tokyo", "en"));
  });
  it("preserves unknown dates and zones without guessing from the browser", () => {
    expect(reviewDueDate("not-a-date", "America/Santiago", "en")).toBeNull();
    expect(reviewDueDate("2026-11-11T15:00:00Z", "invalid/zone", "en")).toBeNull();
  });
});
