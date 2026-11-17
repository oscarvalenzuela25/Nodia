import { describe, expect, it } from "vitest";
import { dividePrice, parseDivisionInput } from "../../../components/PriceDivisionDialog/calculation";
import { SALE_PRICE_MAX } from "../../../utils/salePrice";

describe("price division", () => {
  it("divides the real value before sale rounding, without adding a peso first", () => {
    expect(dividePrice(2888, 2, "sale")).toBe(1440);
    expect(dividePrice(2889, 2, "sale")).toBe(1440);
    expect(dividePrice(2890, 2, "sale")).toBe(1450);
    expect(dividePrice(2889, 2, "net")).toBe(1445);
    expect(dividePrice(1444, 1, "net")).toBe(1444);
    expect(dividePrice(0, 2, "sale")).toBe(0);
    expect(dividePrice(100, 0.5, "sale")).toBe(200);
  });
  it.each([null, Number.NaN, -1, Number.POSITIVE_INFINITY, SALE_PRICE_MAX + 1])("keeps invalid source %s unavailable", value => {
    expect(dividePrice(value, 2, "sale")).toBeNull();
    expect(dividePrice(value, 2, "net")).toBeNull();
  });
  it.each([null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])("rejects divisor %s", divisor => {
    expect(dividePrice(1445, divisor, "sale")).toBeNull();
  });
  it("does not clamp a division or a rounded result outside stored CLP", () => {
    expect(dividePrice(SALE_PRICE_MAX, 0.5, "sale")).toBeNull();
    expect(dividePrice(SALE_PRICE_MAX, 0.5, "net")).toBeNull();
    expect(dividePrice(SALE_PRICE_MAX, 1, "sale")).toBeNull();
    expect(dividePrice(SALE_PRICE_MAX, 1, "net")).toBe(SALE_PRICE_MAX);
  });
  it("accepts a decimal separator without treating incomplete input as zero", () => {
    expect(parseDivisionInput("0")).toBe(0);
    expect(parseDivisionInput(" 0,5 ")).toBe(0.5);
    expect(parseDivisionInput("2.5")).toBe(2.5);
    for (const input of ["", " ", "2.", "2,", "1,2,3", "-1", "Infinity", "1e3"]) expect(parseDivisionInput(input)).toBeNull();
  });
});
