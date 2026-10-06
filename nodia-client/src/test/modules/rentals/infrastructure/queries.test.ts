import { expect, it } from "vitest";
import { validateRentalListQuery } from "../../../../modules/rentals/infrastructure/queries";
it("rejects foreign filters, active on cash and incomplete periods before transport", () => {
  expect(() =>
    validateRentalListQuery("payments", { active: "all" }),
  ).toThrow();
  expect(() =>
    validateRentalListQuery("reservations", { q: { name_cont: "other" } }),
  ).toThrow();
  expect(() =>
    validateRentalListQuery("reservations", {
      q: { guest_name_cont: "Guest" },
      page: 2,
      limit: 20,
    }),
  ).not.toThrow();
  expect(() =>
    validateRentalListQuery("audit-events", { q: { s: "created_at desc" } }),
  ).toThrow();
  expect(() =>
    validateRentalListQuery("expenses", { from_on: "2026-10-01" }),
  ).toThrow();
  expect(() =>
    validateRentalListQuery("collaborator-candidates", {
      search: "ab",
      limit: 20,
    }),
  ).toThrow();
  expect(() =>
    validateRentalListQuery("payments", {
      reservation_id: "9007199254740993",
      from_on: "2026-10-01",
      to_on: "2026-10-05",
    }),
  ).not.toThrow();
});
