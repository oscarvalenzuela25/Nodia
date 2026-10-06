import { describe, expect, it } from "vitest";
import {
  policySchema,
  policyPayload,
} from "../../../../../modules/rentals/components/PolicyModal/schema";
const valid = {
  name: "Flexible",
  is_active: true,
  rules: [
    { min_days_before: "0", refund_percent: "0" },
    { min_days_before: "7", refund_percent: "20.25" },
  ],
};
describe("PolicyModal contract", () => {
  it("sends all rules as one command", () =>
    expect(policyPayload(policySchema.parse(valid)).rules).toEqual([
      { min_days_before: 0, refund_percent: "0" },
      { min_days_before: 7, refund_percent: "20.25" },
    ]));
  it("requires zero, unique thresholds and a bounded array", () => {
    for (const rules of [
      [],
      [valid.rules[1]],
      [valid.rules[0], valid.rules[0]],
      Array.from({ length: 101 }, (_, n) => ({
        min_days_before: String(n),
        refund_percent: "0",
      })),
    ])
      expect(policySchema.safeParse({ ...valid, rules }).success).toBe(false);
  });
  it("rejects percentages over 100 and days past 36500", () => {
    expect(
      policySchema.safeParse({
        ...valid,
        rules: [{ min_days_before: "0", refund_percent: "100.01" }],
      }).success,
    ).toBe(false);
    expect(
      policySchema.safeParse({
        ...valid,
        rules: [
          ...valid.rules,
          { min_days_before: "36501", refund_percent: "50" },
        ],
      }).success,
    ).toBe(false);
  });
});
