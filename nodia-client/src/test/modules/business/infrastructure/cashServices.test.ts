import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cashCategoryParams,
  cashMovementParams,
  getCashMovement,
  getCashMovements,
  getCashReceipt,
  sendCashMutation,
} from "../../../../modules/business/infrastructure/cashServices";
import type { CashMutationCommand } from "../../../../modules/business/infrastructure/cashTypes";
import {
  cashToday,
  formatCashAmount,
  isCashCivilDate,
} from "../../../../modules/business/infrastructure/cashValues";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("../../../../config/api", () => ({ mainInstance: http }));

const businessId = "a0000000-0000-4000-8000-000000000001";
const otherBusiness = "a0000000-0000-4000-8000-000000000002";
const id = "b0000000-0000-4000-8000-000000000001";
const requestKey = "c0000000-0000-4000-8000-000000000001";
const linked = {
  id,
  business_id: businessId,
  category: { id: "9223372036854775807", name: "Mercadería", is_active: false },
  category_id: "9223372036854775807",
  type: "expense",
  amount: "200",
  occurred_on: "2024-02-29",
  description: null,
  is_active: true,
  version: 4,
  source: "invoice",
  invoice: { id: "6", code: null },
};
const summary = {
  currency: "CLP",
  income: { count: 1, total_amount: "200" },
  expense: { count: 1, total_amount: "9007199254740993" },
};
const command: CashMutationCommand = {
  operation: "movement_update",
  id,
  fields: { expected_version: 4, is_active: false },
};

beforeEach(() => vi.resetAllMocks());

describe("Cash API contract", () => {
  it("serializes false, inclusive dates and literal commas precisely", () => {
    const filters = {
      page: 2,
      limit: 10,
      active: false,
      from: "2025-02-01",
      to: "2025-02-28",
      categoryId: "9223372036854775807",
      search: "  boleta, IVA %!_  ",
    };
    const params = cashMovementParams(businessId, filters);
    expect(params.toString()).toContain("boleta%2C+IVA+%25%21_");
    expect(Object.fromEntries(params)).toEqual({
      page: "2",
      limit: "10",
      "q[business_id_eq]": businessId,
      "q[is_active_eq]": "false",
      "q[occurred_on_gteq]": "2025-02-01",
      "q[occurred_on_lteq]": "2025-02-28",
      "q[category_id_eq]": "9223372036854775807",
      "q[search]": "boleta, IVA %!_",
    });
    expect(
      cashCategoryParams(businessId, { page: 1, limit: 10, search: "\u0085\uFEFF" }).has(
        "q[name_cont]",
      ),
    ).toBe(false);
    expect(cashCategoryParams(businessId, { page: 1, limit: 10 }).has("q[is_active_eq]")).toBe(false);
  });

  it("accepts nullable historical invoice folios and preserves a total above MAX_SAFE_INTEGER", async () => {
    http.get.mockResolvedValue({
      data: { data: [linked], summary, meta: { page: 1, limit: 1, total_items: 2, total_pages: 2 } },
    });
    const result = await getCashMovements(businessId, { page: 1, limit: 1 });
    expect(result.data[0]).toEqual(linked);
    expect(result.summary.expense.total_amount).toBe("9007199254740993");
    const amount = result.summary.expense.total_amount;
    expect(formatCashAmount(amount, "es").replace(/\D/g, "")).toBe(amount);
    expect(formatCashAmount(amount, "en").replace(/\D/g, "")).toBe(amount);
  });

  it("rejects an invalid successful sum, missing total, or a valid detail owned by another business", async () => {
    const page = { data: [linked], meta: { page: 1, limit: 2, total_items: 2, total_pages: 1 } };
    http.get.mockResolvedValueOnce({
      data: { ...page, summary: { ...summary, expense: { count: 1, total_amount: 99 } } },
    });
    await expect(getCashMovements(businessId, { page: 1, limit: 2 })).rejects.toThrow();
    http.get.mockResolvedValueOnce({ data: page });
    await expect(getCashMovements(businessId, { page: 1, limit: 2 })).rejects.toThrow();
    http.get.mockResolvedValueOnce({ data: { ...linked, business_id: otherBusiness } });
    await expect(getCashMovement(businessId, id)).rejects.toThrow("cash_resource_scope_mismatch");
  });

  it("uses route target/version and validates receipt ownership and operation", async () => {
    const pending = { request_key: requestKey, status: "processing", operation: "movement_update" };
    http.put.mockResolvedValue({ status: 202, data: pending });
    expect(await sendCashMutation(businessId, requestKey, command)).toEqual(pending);
    expect(http.put).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(new RegExp(`/business-cash-movements/${id}$`)),
      {
        request_key: requestKey,
        expected_version: 4,
        is_active: false,
      },
    );

    const stored = { ...pending, status: "committed", result: { movement: { ...linked, version: 5 } } };
    http.get.mockResolvedValueOnce({ data: { ...stored, operation: "movement_create" } });
    await expect(getCashReceipt(businessId, requestKey, command)).rejects.toThrow(
      "cash_receipt_mismatch",
    );
    http.get.mockResolvedValueOnce({ data: { ...stored, request_key: otherBusiness } });
    await expect(getCashReceipt(businessId, requestKey, command)).rejects.toThrow(
      "cash_receipt_mismatch",
    );
    http.get.mockResolvedValueOnce({ data: stored });
    expect(await getCashReceipt(businessId, requestKey, command)).toEqual(stored);
  });
});

describe("Cash civil dates", () => {
  it("uses the Santiago calendar before and after midnight and supports leap days", () => {
    expect(cashToday(Date.parse("2026-07-01T03:00:00Z"))).toBe("2026-06-30");
    expect(cashToday(Date.parse("2026-07-01T04:00:00Z"))).toBe("2026-07-01");
    expect(isCashCivilDate("2024-02-29")).toBe(true);
    expect(isCashCivilDate("2023-02-29")).toBe(false);
  });
});
