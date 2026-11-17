import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cashCategoryParams,
  cashMovementParams,
  getCashMonthlySummary,
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
const nextRequestKey = "c0000000-0000-4000-8000-000000000002";
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
const invoiceResult = {
  invoice_id: "9223372036854775807",
  invoice_version: 2,
  cash_movement_id: null,
};
const invoiceUpdate: CashMutationCommand = {
  operation: "invoice_update",
  id: invoiceResult.invoice_id,
  fields: { expected_version: 1, is_active: false },
};
const ocrCommand = (file = new File(["invoice"], "boleta.pdf", { type: "application/pdf" })):
  Extract<CashMutationCommand, { operation: "invoice_ocr_confirm" }> => ({
  operation: "invoice_ocr_confirm",
  fields: {
    invoice: { total_amount: 500, issue_date: "2024-02-29", cash_category_id: "9223372036854775807" },
    items: [{
      kind: "manual_match",
      product_id: "9223372036854775806",
      expected_version: 7,
      changes: {},
      line: {
        invoice_code: null, name: "Té \uFFFD", alias: "", alias_reviewed: true,
        cost_price: 500, quantity: 1,
      },
    }],
  },
  file,
});

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

describe("Cash Overview and invoice receipts", () => {
  it("loads the full Santiago month in the business scope and preserves decimal totals", async () => {
    const signal = new AbortController().signal;
    const period = { from: "2024-02-01", to: "2024-02-29", time_zone: "America/Santiago" };
    const monthly = {
      period,
      summary: { ...summary, income: { count: 0, total_amount: "0" } },
    };
    http.get.mockResolvedValueOnce({ data: monthly });
    expect(await getCashMonthlySummary(businessId, signal)).toEqual(monthly);
    expect(http.get).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/\/business-cash-movements\/monthly-summary$/),
      { params: { business_id: businessId }, signal },
    );

    http.get.mockResolvedValueOnce({ data: { ...monthly, period: { ...period, to: "2024-03-01" } } });
    await expect(getCashMonthlySummary(businessId)).rejects.toThrow();
  });

  it("keeps invoice fields equivalent in JSON and multipart, with explicit nullable IDs", async () => {
    const file = new File(["invoice"], "factura.pdf", { type: "application/pdf" });
    const create = {
      operation: "invoice_create",
      fields: {
        provider_id: null,
        cash_category_id: null,
        path_storage: "",
        code: null,
        total_amount: 0,
        is_active: false,
        data: { issue_date: "2024-02-29" },
      },
    } as const;
    const stored = {
      request_key: requestKey, status: "committed", operation: create.operation, result: invoiceResult,
    };
    http.post.mockResolvedValue({ status: 201, data: stored });
    expect(await sendCashMutation(businessId, requestKey, create)).toEqual(stored);
    expect(http.post).toHaveBeenNthCalledWith(1, expect.stringMatching(/\/invoices$/), {
      ...create.fields, request_key: requestKey, business_id: businessId,
    });
    const storedFile = { ...stored, request_key: nextRequestKey };
    http.post.mockResolvedValueOnce({ status: 201, data: storedFile });
    expect(await sendCashMutation(businessId, nextRequestKey, { ...create, file })).toEqual(storedFile);
    const [route, form] = http.post.mock.calls[1] as [string, FormData];
    expect(route).toMatch(/\/invoices$/);
    expect(Object.fromEntries(form)).toEqual({
      file,
      cash_category_id: "null",
      provider_id: "null",
      path_storage: "",
      total_amount: "0",
      is_active: "false",
      data: '{"issue_date":"2024-02-29"}',
      request_key: nextRequestKey,
      business_id: businessId,
    });
    expect(form.get("file")).toBe(file);
    expect(http.post.mock.calls[1][2]).toEqual({ headers: { "Content-Type": undefined } });
  });

  it("distinguishes keeping a category from withdrawing it and verifies the invoice target", async () => {
    const receipt = {
      request_key: requestKey, status: "committed", operation: invoiceUpdate.operation, result: invoiceResult,
    };
    http.put.mockResolvedValue({ status: 200, data: receipt });
    expect(await sendCashMutation(businessId, requestKey, invoiceUpdate)).toEqual(receipt);
    expect(http.put).toHaveBeenNthCalledWith(1, expect.stringMatching(new RegExp(`/invoices/${invoiceUpdate.id}$`)), {
      request_key: requestKey, expected_version: 1, is_active: false,
    });
    const withdraw = { ...invoiceUpdate, fields: { ...invoiceUpdate.fields, cash_category_id: null } };
    const withdrawn = { ...receipt, request_key: nextRequestKey };
    http.put.mockResolvedValueOnce({ status: 200, data: withdrawn });
    expect(await sendCashMutation(businessId, nextRequestKey, withdraw)).toEqual(withdrawn);
    expect(http.put.mock.calls[1][1]).toEqual({
      request_key: nextRequestKey, expected_version: 1, is_active: false, cash_category_id: null,
    });

    http.get.mockResolvedValue({ data: { ...receipt, result: { ...invoiceResult, invoice_id: "41" } } });
    await expect(getCashReceipt(businessId, requestKey, invoiceUpdate)).rejects.toThrow("cash_receipt_mismatch");
    expect(http.get).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining(`/businesses/${businessId}/cash-mutation-requests/${requestKey}`),
    );
  });

  it("sends one OCR command and the original file and verifies ordered product identities", async () => {
    const draft = ocrCommand();
    const receipt = {
      request_key: requestKey, status: "committed", operation: draft.operation,
      result: { ...invoiceResult, products: [{ id: "9223372036854775806", version: 7 }] },
    };
    http.post.mockResolvedValue({ status: 201, data: receipt });
    expect(await sendCashMutation(businessId, requestKey, draft)).toEqual(receipt);
    const [route, form] = http.post.mock.calls[0] as [string, FormData];
    expect(route).toMatch(/\/invoices\/ocr-confirmations$/);
    expect([...form.keys()]).toEqual(["command", "file"]);
    const json = form.get("command");
    expect(json).toEqual(expect.stringContaining("\\uFFFD"));
    expect(JSON.parse(String(json))).toEqual({
      ...draft.fields, request_key: requestKey, business_id: businessId,
    });
    expect(form.get("file")).toBe(draft.file);

    http.get
      .mockResolvedValueOnce({ data: { ...receipt, result: { ...invoiceResult, products: [{ id: "41", version: 7 }] } } })
      .mockResolvedValueOnce({ data: { ...receipt, result: { ...invoiceResult, products: [
        ...receipt.result.products, { id: "41", version: 7 },
      ] } } });
    await expect(getCashReceipt(businessId, requestKey, draft)).rejects.toThrow("cash_receipt_mismatch");
    await expect(getCashReceipt(businessId, requestKey, draft)).rejects.toThrow("cash_receipt_mismatch");
  });

  it("rejects an incomplete or oversized OCR command before sending the upload", async () => {
    const draft = ocrCommand();
    await expect(sendCashMutation(businessId, requestKey, {
      ...draft, fields: { ...draft.fields, items: [] },
    })).rejects.toMatchObject({ statusCode: 400 });

    draft.fields.items[0].line.name = "é".repeat(600_000);
    await expect(sendCashMutation(businessId, requestKey, draft)).rejects.toMatchObject({ statusCode: 413 });
    expect(http.post).not.toHaveBeenCalled();
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
