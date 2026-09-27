import { describe, it, expect } from "vitest";
import {
  calculatePriceDiff,
  resolveHistoricalLog,
  getPriceChangeStatus,
} from "../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/helpers";
import type { ProductLogEntity } from "../../../../../../../modules/business/infrastructure/types";

describe("ProductsTab helpers", () => {
  describe("calculatePriceDiff", () => {
    it("returns null if historicalSale or currentSale are invalid or <= 0", () => {
      expect(calculatePriceDiff(100, undefined)).toBeNull();
      expect(calculatePriceDiff(100, 0)).toBeNull();
      expect(calculatePriceDiff(0, 100)).toBeNull();
      expect(calculatePriceDiff(-10, 100)).toBeNull();
    });

    it("returns null if price did not change", () => {
      expect(calculatePriceDiff(1000, 1000)).toBeNull();
    });

    it("calculates price increase correctly", () => {
      const diff = calculatePriceDiff(1200, 1000);
      expect(diff).toEqual({
        diff: 200,
        percent: 20,
        isIncrease: true,
      });
    });

    it("calculates price decrease correctly", () => {
      const diff = calculatePriceDiff(800, 1000);
      expect(diff).toEqual({
        diff: -200,
        percent: 20,
        isIncrease: false,
      });
    });
  });

  describe("resolveHistoricalLog", () => {
    it("returns null when logs array is empty", () => {
      expect(resolveHistoricalLog({ sale_price: 1000, cost_price: 700 }, [])).toBeNull();
    });

    it("returns the single baseline log if only one log exists", () => {
      const log1: ProductLogEntity = {
        id: "log-1",
        product_id: "prod-1",
        code: "P1",
        name: "Prod 1",
        cost_price: 700,
        cost_price_tax: 833,
        profit_percentage: 30,
        sale_price: 1000,
        stock: 10,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };

      const result = resolveHistoricalLog({ sale_price: 1000, cost_price: 700 }, [log1]);
      expect(result).toBe(log1);
    });

    it("returns logs[1] when logs[0] matches the current product values (created by the latest update)", () => {
      const logNewest: ProductLogEntity = {
        id: "log-2",
        product_id: "prod-1",
        code: "P1",
        name: "Prod 1",
        cost_price: 900,
        cost_price_tax: 1071,
        profit_percentage: 30,
        sale_price: 1300,
        stock: 15,
        created_at: "2026-02-01T00:00:00Z",
        updated_at: "2026-02-01T00:00:00Z",
      };
      const logPrevious: ProductLogEntity = {
        id: "log-1",
        product_id: "prod-1",
        code: "P1",
        name: "Prod 1",
        cost_price: 700,
        cost_price_tax: 833,
        profit_percentage: 30,
        sale_price: 1000,
        stock: 10,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };

      const result = resolveHistoricalLog(
        { sale_price: 1300, cost_price: 900 },
        [logNewest, logPrevious]
      );
      expect(result).toBe(logPrevious);
    });

    it("returns logs[0] if its price differs from current product", () => {
      const log1: ProductLogEntity = {
        id: "log-1",
        product_id: "prod-1",
        code: "P1",
        name: "Prod 1",
        cost_price: 700,
        cost_price_tax: 833,
        profit_percentage: 30,
        sale_price: 1000,
        stock: 10,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };

      const result = resolveHistoricalLog({ sale_price: 1500, cost_price: 1000 }, [log1]);
      expect(result).toBe(log1);
    });
  });

  describe("getPriceChangeStatus", () => {
    it("returns unchanged when historicalLog is null", () => {
      expect(getPriceChangeStatus({ sale_price: 1000, cost_price: 700 }, null)).toBe("unchanged");
    });

    it("returns unchanged when sale prices are equal", () => {
      const log = { sale_price: 1000 } as ProductLogEntity;
      expect(getPriceChangeStatus({ sale_price: 1000, cost_price: 700 }, log)).toBe("unchanged");
    });

    it("returns increased when current price is higher", () => {
      const log = { sale_price: 1000 } as ProductLogEntity;
      expect(getPriceChangeStatus({ sale_price: 1200, cost_price: 700 }, log)).toBe("increased");
    });

    it("returns decreased when current price is lower", () => {
      const log = { sale_price: 1000 } as ProductLogEntity;
      expect(getPriceChangeStatus({ sale_price: 800, cost_price: 700 }, log)).toBe("decreased");
    });
  });
});
