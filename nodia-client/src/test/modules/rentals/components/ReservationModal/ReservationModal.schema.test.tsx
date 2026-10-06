import { describe, expect, it } from "vitest";
import {
  agreementEditable,
  reservationPayload,
  reservationSchema,
} from "../../../../../modules/rentals/components/ReservationModal/schema";
const valid = {
  guest_name: "Huésped",
  guest_contact: "Contacto",
  guests_count: "2",
  channel: "whatsapp" as const,
  external_reference: "",
  check_in_on: "2026-10-01",
  check_out_on: "2026-10-03",
  check_in_time: "15:00",
  check_out_time: "11:00",
  nightly_rate: "100000",
  cleaning_fee: "0",
  discount_amount: "0",
  commission_amount: "0",
  deposit_amount: "40000",
  cancellation_policy_id: null,
  deposit_due_at: "",
  balance_due_at: "",
  notes: "",
  is_active: true,
};
describe("reservation agreement", () => {
  it.each(["", "01", "1.5", "-1", "1e3", "9223372036854775808"])(
    "rejects malformed amount %s without throwing",
    (nightly_rate) =>
      expect(
        reservationSchema.safeParse({ ...valid, nightly_rate }).success,
      ).toBe(false),
  );
  it("charges civil nights, rejects nonexistent dates and excessive discount", () => {
    expect(reservationSchema.safeParse(valid).success).toBe(true);
    expect(
      reservationSchema.safeParse({ ...valid, check_in_on: "2026-02-30" })
        .success,
    ).toBe(false);
    expect(
      reservationSchema.safeParse({ ...valid, discount_amount: "300000" })
        .success,
    ).toBe(false);
  });
  it("freezes all commercial fields for any money history, including voided money", () => {
    expect(agreementEditable("draft", 1, true)).toBe(false);
    expect(agreementEditable("draft", undefined, true)).toBe(false);
    expect(agreementEditable("draft", 0, true)).toBe(true);
    expect(reservationPayload(valid, false)).toEqual({
      guest_name: "Huésped",
      guest_contact: "Contacto",
      notes: null,
      is_active: true,
    });
  });
  it("Airbnb requires zero deposit and no local policy; preserves exact money", () => {
    expect(
      reservationSchema.safeParse({
        ...valid,
        channel: "airbnb",
        deposit_amount: "0",
      }).success,
    ).toBe(true);
    expect(
      reservationSchema.safeParse({ ...valid, channel: "airbnb" }).success,
    ).toBe(false);
    expect(
      reservationPayload({ ...valid, nightly_rate: "9007199254740993" }, true),
    ).toHaveProperty("nightly_rate", "9007199254740993");
  });
});
