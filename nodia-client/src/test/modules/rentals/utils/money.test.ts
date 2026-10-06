import { describe, expect, it } from "vitest";
import {
  estimateRentalTotal,
  formatRentalAmount,
  isRentalMoney,
  percentBasisPoints,
  suggestedDeposit,
} from "../../../../modules/rentals/utils/money";
describe("rental CLP", () => {
  it.each(["", "01", "1.2", "1e3", "-1", "NaN", "9223372036854775808"])(
    "rejects noncanonical or out-of-range %s",
    (value) => expect(isRentalMoney(value)).toBe(false),
  );
  it("retains exact amounts beyond Number precision and signed aggregate totals", () => {
    expect(estimateRentalTotal("9007199254740993", 2, "7", "1")).toBe(
      "18014398509481992",
    );
    expect(formatRentalAmount("9007199254740993", "en")).toContain(
      "9,007,199,254,740,993",
    );
    expect(formatRentalAmount("-18446744073709551614", "en")).toContain(
      "18,446,744,073,709,551,614",
    );
    expect(formatRentalAmount("0", "es")).toContain("0");
    expect(isRentalMoney("0", true)).toBe(false);
  });
  it("rejects overflowing totals and floors suggested fractional pesos explicitly", () => {
    expect(() => estimateRentalTotal("9223372036854775807", 2)).toThrow();
    expect(() => estimateRentalTotal("10", 1, "0", "10")).toThrow();
    expect(suggestedDeposit("101", "20.50")).toBe("20");
    expect(percentBasisPoints("100.00")).toBe(10000n);
    expect(() => percentBasisPoints("100.01")).toThrow();
  });
});
