import { describe, expect, it } from "vitest";
import {
  buildExpensePayload,
  expenseSchema,
} from "../../../../../modules/rentals/components/ExpenseModal/schema";
const expense = {
  name: "Laundry",
  amount: "10000",
  incurred_on: "2026-10-01",
  status: "pending" as const,
  paid_on: "",
  reservation_id: null,
  category: "",
  notes: "",
};
describe("Rental expense contract", () => {
  it("creates a pending expense with explicit nullable association/payment date", () => {
    expect(buildExpensePayload(expenseSchema.parse(expense))).toEqual({
      name: "Laundry",
      amount: "10000",
      incurred_on: "2026-10-01",
      status: "pending",
      paid_on: null,
      reservation_id: null,
      category: null,
      notes: null,
    });
  });
  it("never reassigns commercial facts or status of a paid expense", () => {
    expect(
      buildExpensePayload(
        { ...expense, status: "paid", paid_on: "2026-10-02" },
        "paid",
      ),
    ).toEqual({
      name: "Laundry",
      category: null,
      notes: null,
      reservation_id: null,
    });
  });
  it("updates pending expenses without status or paid_on", () => {
    expect(buildExpensePayload(expense, "pending")).not.toHaveProperty(
      "status",
    );
    expect(buildExpensePayload(expense, "pending")).not.toHaveProperty(
      "paid_on",
    );
  });
  it.each(["", "2026-09-30", "2026-02-30"])(
    "rejects paid date %s",
    (paid_on) => {
      expect(
        expenseSchema.safeParse({ ...expense, status: "paid", paid_on })
          .success,
      ).toBe(false);
    },
  );
});
