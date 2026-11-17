import { describe, expect, it } from "vitest";
import { roundSalePrice, SALE_PRICE_MAX } from "../../utils/salePrice";

describe("sale price rounding", () => {
  it.each([[1444, 1440], [1445, 1450], [1444.5, 1440], [0, 0], [4, 0], [5, 10], [10, 10], [2147483644, 2147483640]])("rounds %s directly to %s", (value, expected) => {
    expect(roundSalePrice(value)).toBe(expected);
  });
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, SALE_PRICE_MAX + 1, SALE_PRICE_MAX, 2147483645])("rejects invalid money or rounding overflow %s", value => {
    expect(roundSalePrice(value)).toBeNull();
  });
});
