import { describe, expect, it } from "vitest";
import {
  propertySchema,
  propertyPayload,
} from "../../../../../modules/rentals/components/PropertyModal/schema";

const valid = {
  name: " Casa ",
  location: "",
  timezone: "America/Santiago",
  max_guests: "4",
  check_in_time: "15:00",
  check_out_time: "11:00",
  default_nightly_rate: "",
  default_deposit_percent: "",
  minimum_turnover_minutes: "0",
  notes: "",
  is_active: true,
};
describe("PropertyModal contract", () => {
  it("retains absent prices as null and exact CLP amounts without inventing a policy", () => {
    expect(propertyPayload(propertySchema.parse(valid))).toEqual({
      ...valid,
      name: "Casa",
      location: null,
      max_guests: 4,
      default_nightly_rate: null,
      default_deposit_percent: null,
      minimum_turnover_minutes: 0,
      notes: null,
    });
    expect(
      propertySchema.parse({
        ...valid,
        default_nightly_rate: "9223372036854775807",
        default_deposit_percent: "0",
      }).default_nightly_rate,
    ).toBe("9223372036854775807");
  });
  it.each(["", "0", "1001", "4.5", "NaN"])(
    "rejects invalid capacity %s",
    (max_guests) =>
      expect(propertySchema.safeParse({ ...valid, max_guests }).success).toBe(
        false,
      ),
  );
  it.each(["0", "-1", "01", "9223372036854775808"])(
    "rejects invalid nightly amount %s",
    (default_nightly_rate) =>
      expect(
        propertySchema.safeParse({ ...valid, default_nightly_rate }).success,
      ).toBe(false),
  );
  it("validates timezone, civil time, percentages and turnover bounds", () => {
    for (const change of [
      { timezone: "missing" },
      { check_in_time: "24:00" },
      { default_deposit_percent: "100.01" },
      { minimum_turnover_minutes: "10081" },
    ])
      expect(propertySchema.safeParse({ ...valid, ...change }).success).toBe(
        false,
      );
  });
});
