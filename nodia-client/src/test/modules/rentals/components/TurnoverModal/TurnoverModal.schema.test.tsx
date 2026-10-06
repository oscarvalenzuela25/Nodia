import { expect, it } from "vitest";
import i18n from "../../../../../translate";
import {
  turnoverSchema,
  turnoverPayload,
} from "../../../../../modules/rentals/components/TurnoverModal/schema";
const valid = {
  linen_ready: "unknown" as const,
  cleaning_status: "pending" as const,
  planned_ready_at: "",
  ready_at: "",
  notes: "",
};
it("keeps recambio unknown, false and true distinct", () => {
  expect(turnoverPayload(valid).linen_ready).toBeNull();
  expect(turnoverPayload({ ...valid, linen_ready: "no" }).linen_ready).toBe(
    false,
  );
  expect(turnoverPayload({ ...valid, linen_ready: "yes" }).linen_ready).toBe(
    true,
  );
});
it("a future plan cannot claim actual readiness without linen and completed cleaning", () => {
  expect(
    turnoverSchema.safeParse({
      ...valid,
      planned_ready_at: "2099-01-01T12:00:00Z",
    }).success,
  ).toBe(true);
  const notReady = turnoverSchema.safeParse({
    ...valid,
    ready_at: "2020-01-01T12:00:00Z",
  });
  expect(notReady.success).toBe(false);
  if (!notReady.success) {
    for (const issue of notReady.error.issues) {
      for (const language of ["es", "en"]) {
        const translate = i18n.getFixedT(language);
        expect(translate(issue.message)).not.toBe(issue.message);
        expect(translate(issue.message).trim().length).toBeGreaterThan(0);
      }
    }
  }
  expect(
    turnoverSchema.safeParse({
      ...valid,
      linen_ready: "yes",
      cleaning_status: "completed",
      ready_at: "2020-01-01T12:00:00Z",
    }).success,
  ).toBe(true);
});
