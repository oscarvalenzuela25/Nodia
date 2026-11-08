import { describe, expect, it } from "vitest";
import { formatQuantity, lineSubtotal, quantityFromInput, quantityThousandths, stepSaleQuantity } from "../../../../modules/business/infrastructure/saleQuantities";

describe("fractional sale quantity arithmetic", () => {
  it("accepts zero and comma/point with three places, preserving thousandths exactly", () => {
    expect(quantityFromInput("0")).toBe(0);
    expect(quantityFromInput("1,001")).toBe(1.001);
    expect(quantityThousandths(1.001)).toBe(1001n);
    expect(quantityThousandths("2147483646.999")).toBe(2147483646999n);
    for (const raw of ["", "-1", "01", ".5", "1.", "1e2", "NaN", "1.0001", "2147483647.001", "9".repeat(1000)]) expect(quantityFromInput(raw)).toBeNull();
  });
  it("rounds each line once half-up to CLP without floating point or losing large amounts", () => {
    expect(lineSubtotal("10000", 1.125)).toBe("11250");
    expect(lineSubtotal("500", .001)).toBe("1");
    expect(lineSubtotal("499", .001)).toBe("0");
    expect(lineSubtotal("9007199254740993", .125)).toBe("1125899906842624");
    expect(lineSubtotal("10000", 0)).toBe("0");
    expect(() => lineSubtotal("10000", .0001)).toThrow();
  });
  it("increments a fractional quantity exactly and stops at zero without inventing a negative row", () => {
    expect(stepSaleQuantity(1.001, 1)).toBe(2.001);
    expect(stepSaleQuantity(.125, -1)).toBe(0);
    expect(() => stepSaleQuantity(2147483647, 1)).toThrow();
  });
  it("formats fractional and large aggregate quantities without unsafe Number conversion", () => {
    expect(formatQuantity("1.125", "es")).toBe("1,125");
    expect(formatQuantity("1.125", "en")).toBe("1.125");
    expect(formatQuantity("9007199254740993.001", "es")).toBe("9.007.199.254.740.993,001");
    expect(formatQuantity("0.000", "es")).toBe("0");
  });
});
