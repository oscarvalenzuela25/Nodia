import { describe, expect, it } from "vitest";
import {
  FINANCE_MAX_AMOUNT,
  formatFinanceAmount,
  isFinanceAmount,
} from "../../../../modules/finances/utils/money";

describe("finance money", () => {
  it.each(["1", "100000", "9007199254740993", "9223372036854775807"])(
    "accepts positive integer pesos exactly: %s",
    (amount) => {
      expect(isFinanceAmount(amount)).toBe(true);
    },
  );

  it.each([
    "0",
    "00",
    "01",
    "-1",
    "+1",
    "1.0",
    "1,000",
    "1e6",
    " 1",
    "1 ",
    "",
    "9223372036854775808",
    "999999999999999999999",
    1,
    0,
    null,
    undefined,
    false,
    NaN,
    Infinity,
  ])("rejects invalid or overflowing row amounts: %s", (amount) => {
    expect(isFinanceAmount(amount)).toBe(false);
  });

  it("defines the PostgreSQL signed bigint upper limit exactly", () => {
    expect(FINANCE_MAX_AMOUNT).toBe(9223372036854775807n);
  });

  it.each([
    "9007199254740993",
    "18446744073709551614",
    "18446744073709551614000000000000000000000000000000000",
  ])(
    "formats exact aggregates beyond safe numbers and the row limit: %s",
    (amount) => {
      expect(formatFinanceAmount(amount, "es").replace(/\D/g, "")).toBe(amount);
      expect(formatFinanceAmount(amount, "en").replace(/\D/g, "")).toBe(amount);
    },
  );

  it("preserves zero and negative net without adding fractional pesos", () => {
    expect(formatFinanceAmount("0", "es")).toBe("$0");
    expect(formatFinanceAmount("-9007199254740993", "es")).toBe(
      "$-9.007.199.254.740.993",
    );
    expect(formatFinanceAmount("-9007199254740993", "en")).toBe(
      "-CLP 9,007,199,254,740,993",
    );
  });

  it.each(["", "1.5", "1e3", "NaN", "+1", " 5"])(
    "refuses to render malformed aggregates: %s",
    (amount) => {
      expect(() => formatFinanceAmount(amount)).toThrow(
        "finance:invalid_amount",
      );
    },
  );
});
