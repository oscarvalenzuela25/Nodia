import { describe, expect, it } from "vitest";
import {
  buildPaymentPayload,
  paymentSchema,
} from "../../../../../modules/rentals/components/PaymentModal/schema";

const payment = {
  reservation_id: "2",
  type: "payment" as const,
  amount: "1000",
  occurred_on: "2026-10-04",
  method: "",
  reference: "",
  notes: "",
  platform_reference: "Platform 42",
  platform_description: "Manual agreement",
};
describe("Rental payment capture contract", () => {
  it.each(["", "0", "-1", "1.1", "1e3", "010", "9223372036854775808"])(
    "rejects invalid CLP %s without converting it",
    (amount) => {
      expect(paymentSchema.safeParse({ ...payment, amount }).success).toBe(
        false,
      );
    },
  );
  it("retains exact bigint and nulls while sending platform terms only for the first capture", () => {
    const data = paymentSchema.parse({
      ...payment,
      amount: "9223372036854775807",
    });
    expect(buildPaymentPayload(data, false)).toEqual({
      reservation_id: "2",
      type: "payment",
      amount: "9223372036854775807",
      occurred_on: "2026-10-04",
      method: null,
      reference: null,
      notes: null,
    });
    expect(buildPaymentPayload(data, true).platform_policy).toEqual({
      reference: "Platform 42",
      description: "Manual agreement",
    });
  });
  it("rejects a nonexistent civil date", () => {
    expect(
      paymentSchema.safeParse({ ...payment, occurred_on: "2026-02-30" })
        .success,
    ).toBe(false);
  });
});
