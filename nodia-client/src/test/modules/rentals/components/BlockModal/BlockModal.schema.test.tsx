import { expect, it } from "vitest";
import { blockSchema } from "../../../../../modules/rentals/components/BlockModal/schema";
it("requires explicit offset and ordered interval; keeps inactive false", () => {
  const valid = {
    starts_at: "2026-10-01T15:00:00-03:00",
    ends_at: "2026-10-03T11:00:00-03:00",
    reason: "Mantención",
    notes: "",
    is_active: false,
  };
  expect(blockSchema.parse(valid).is_active).toBe(false);
  expect(
    blockSchema.safeParse({ ...valid, starts_at: "2026-10-01T15:00" }).success,
  ).toBe(false);
  expect(
    blockSchema.safeParse({ ...valid, ends_at: valid.starts_at }).success,
  ).toBe(false);
});
