import { describe, expect, it } from "vitest";
import {
  addCivilDays,
  countNights,
  isCivilDate,
  localDateTimeToInstant,
  todayInZone,
  toLocalDateTime,
} from "../../../../modules/rentals/utils/dates";
describe("rental civil dates and Santiago", () => {
  it("counts nights across DST as civil dates rather than 24-hour blocks", () => {
    expect(countNights("2026-09-05", "2026-09-07")).toBe(2);
    expect(addCivilDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(isCivilDate("2026-02-29")).toBe(false);
    expect(() => countNights("2026-01-01", "2028-01-01")).toThrow();
  });
  it("requires a unique real local minute and rejects DST gaps and overlaps", () => {
    expect(() =>
      localDateTimeToInstant("2026-09-06T00:30", "America/Santiago"),
    ).toThrow();
    expect(() =>
      localDateTimeToInstant("2026-04-04T23:30", "America/Santiago"),
    ).toThrow();
    expect(localDateTimeToInstant("2026-10-04T15:00", "America/Santiago")).toBe(
      "2026-10-04T18:00:00.000Z",
    );
    expect(() =>
      localDateTimeToInstant("2026-10-04T15:00", "Invalid/Timezone"),
    ).toThrow();
  });
  it("derives the local date without the machine's timezone", () => {
    expect(
      todayInZone("America/Santiago", new Date("2026-10-04T01:00:00Z")),
    ).toBe("2026-10-03");
    expect(toLocalDateTime("2026-10-04T18:00:00Z", "America/Santiago")).toBe(
      "2026-10-04T15:00",
    );
    expect(() =>
      toLocalDateTime("2026-10-04T18:00:00", "America/Santiago"),
    ).toThrow();
  });
});
