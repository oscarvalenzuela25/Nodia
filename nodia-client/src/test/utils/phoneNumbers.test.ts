import { expect, it } from "vitest";
import {
  isPhoneContact,
  normalizedPhone,
  phoneContactParts,
} from "../../utils/phoneNumbers";
it("splits valid international phones and preserves free text, extensions and incomplete drafts", () => {
  expect(phoneContactParts("+56 9 8765 4321")).toEqual({
    country: "CL",
    number: "987654321",
  });
  expect(phoneContactParts("+1 202 555 0123")).toEqual({
    country: "US",
    number: "2025550123",
  });
  for (const number of [
    "email@example.test",
    "Contacto histórico",
    "+56 9",
    "+1 202 555 0123 ext. 123",
  ])
    expect(phoneContactParts(number)).toEqual({ country: "CL", number });
  expect(isPhoneContact("98 76")).toBe(true);
  expect(isPhoneContact("email@example.test")).toBe(false);
  expect(normalizedPhone("US", "2025550123")).toBe("+12025550123");
  expect(normalizedPhone("CL", "123")).toBeUndefined();
  expect(normalizedPhone("CL", "+12025550123")).toBeUndefined();
});
