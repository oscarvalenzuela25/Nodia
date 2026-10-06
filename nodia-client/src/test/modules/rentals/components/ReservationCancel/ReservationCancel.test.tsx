import { expect, it } from "vitest";
import { cancellationPayload } from "../../../../../modules/rentals/components/ReservationCancel/schema";
it("requires manual Airbnb resolution even for a zero refund", () => {
  const valid = {
    cancelled_at: "2026-10-01T12:00:00Z",
    refund_amount: "0",
    resolution_note: "Resuelto en plataforma",
  };
  expect(cancellationPayload(valid, true)).toEqual(valid);
  expect(() =>
    cancellationPayload({ ...valid, resolution_note: "" }, true),
  ).toThrow();
  expect(cancellationPayload(valid, false)).toEqual({
    cancelled_at: valid.cancelled_at,
  });
});
