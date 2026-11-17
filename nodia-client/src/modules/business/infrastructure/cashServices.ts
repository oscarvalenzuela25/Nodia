import { mainInstance } from "../../../config/api";
import { apiPath } from "../../../config/apiPath";
import {
  cashCatalogIdSchema,
  cashCategoryListSchema,
  cashCategorySchema,
  cashMonthlySummarySchema,
  cashMovementListSchema,
  cashMovementSchema,
  cashReceiptSchema,
  cashUuidSchema,
  cashWriteResultSchema,
} from "./cashSchemas";
import type {
  CashCategoryFilters,
  CashMovementFilters,
  CashMutationCommand,
  CashReceipt,
} from "./cashTypes";
import { trimCashText } from "./cashValues";

const categories = apiPath("/business-cash-categories");
const movements = apiPath("/business-cash-movements");
const invoices = apiPath("/invoices");
const maxInvoiceFileBytes = 10 * 1024 * 1024;
const maxOcrCommandBytes = 1024 * 1024;
const multipartHeaders = { headers: { "Content-Type": undefined } };

export class CashCommandValidationError extends Error {
  readonly statusCode: 400 | 413;

  constructor(statusCode: 400 | 413) {
    super("business:cash_invalid_command");
    this.name = "CashCommandValidationError";
    this.statusCode = statusCode;
  }
}

const scopedParams = (
  businessId: string,
  { page, limit, active }: CashCategoryFilters | CashMovementFilters,
) => {
  // Axios sends URLSearchParams as encoded text. A literal comma must reach
  // the Server's qs parser as %2C because it also accepts comma-delimited arrays.
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    "q[business_id_eq]": businessId,
  });
  if (active !== undefined) params.set("q[is_active_eq]", String(active));
  return params;
};

export function cashCategoryParams(businessId: string, filters: CashCategoryFilters) {
  const params = scopedParams(businessId, filters);
  const search = trimCashText(filters.search ?? "");
  if (search) params.set("q[name_cont]", search);
  return params;
}

export function cashMovementParams(businessId: string, filters: CashMovementFilters) {
  const params = scopedParams(businessId, filters);
  const search = trimCashText(filters.search ?? "");
  if (search) params.set("q[search]", search);
  if (filters.categoryId) params.set("q[category_id_eq]", filters.categoryId);
  if (filters.from) params.set("q[occurred_on_gteq]", filters.from);
  if (filters.to) params.set("q[occurred_on_lteq]", filters.to);
  if (filters.sort) params.set("q[s]", filters.sort);
  return params;
}

function assertResourceIdentity(
  businessId: string,
  row: { business_id: string; id: string },
  id?: string,
): void {
  if (
    row.business_id.toLowerCase() !== businessId.toLowerCase() ||
    (id && row.id.toLowerCase() !== id.toLowerCase())
  )
    throw new Error("cash_resource_scope_mismatch");
}

function assertPageIdentity(
  businessId: string,
  filters: CashCategoryFilters | CashMovementFilters,
  response: { data: { business_id: string; id: string }[]; meta: { page: number; limit: number } },
): void {
  if (response.meta.page !== filters.page || response.meta.limit !== filters.limit)
    throw new Error("cash_page_mismatch");
  for (const row of response.data) assertResourceIdentity(businessId, row);
}

export async function getCashCategories(
  businessId: string,
  filters: CashCategoryFilters,
  signal?: AbortSignal,
) {
  const response = await mainInstance.get<unknown>(categories, {
    params: cashCategoryParams(businessId, filters),
    signal,
  });
  const result = cashCategoryListSchema.parse(response.data);
  assertPageIdentity(businessId, filters, result);
  return result;
}

export async function getCashCategory(businessId: string, id: string, signal?: AbortSignal) {
  const response = await mainInstance.get<unknown>(`${categories}/${cashCatalogIdSchema.parse(id)}`, {
    signal,
  });
  const row = cashCategorySchema.parse(response.data);
  assertResourceIdentity(businessId, row, id);
  return row;
}

export async function getCashMovements(
  businessId: string,
  filters: CashMovementFilters,
  signal?: AbortSignal,
) {
  const response = await mainInstance.get<unknown>(movements, {
    params: cashMovementParams(businessId, filters),
    signal,
  });
  const result = cashMovementListSchema.parse(response.data);
  assertPageIdentity(businessId, filters, result);
  return result;
}

export async function getCashMovement(businessId: string, id: string, signal?: AbortSignal) {
  const response = await mainInstance.get<unknown>(`${movements}/${cashUuidSchema.parse(id)}`, {
    signal,
  });
  const row = cashMovementSchema.parse(response.data);
  assertResourceIdentity(businessId, row, id);
  return row;
}

export async function getCashMonthlySummary(businessId: string, signal?: AbortSignal) {
  const response = await mainInstance.get<unknown>(`${movements}/monthly-summary`, {
    params: { business_id: cashUuidSchema.parse(businessId) },
    signal,
  });
  return cashMonthlySummarySchema.parse(response.data);
}

function assertReceiptIdentity(
  businessId: string,
  requestKey: string,
  command: CashMutationCommand,
  receipt: CashReceipt,
): void {
  if (
    receipt.request_key.toLowerCase() !== requestKey.toLowerCase() ||
    ("operation" in receipt && receipt.operation !== command.operation)
  )
    throw new Error("cash_receipt_mismatch");
  if (receipt.status !== "committed") return;
  const { result } = receipt;
  if ("invoice_id" in result) {
    // The receipt envelope omits business_id for invoices. The receipt read
    // itself is scoped by business and actor, and writes verify exact targets.
    if (command.operation === "invoice_update" && result.invoice_id !== command.id) {
      throw new Error("cash_receipt_mismatch");
    }
    if (
      command.operation === "invoice_ocr_confirm" &&
      (!("products" in result) ||
        result.products.length !== command.fields.items.length ||
        command.fields.items.some(
          (item, index) => item.kind !== "create" && item.product_id !== result.products[index]?.id,
        ))
    ) {
      throw new Error("cash_receipt_mismatch");
    }
    return;
  }
  const row = "category" in result ? result.category : result.movement;
  assertResourceIdentity(businessId, row, "id" in command ? command.id : undefined);
}

export async function getCashReceipt(
  businessId: string,
  requestKey: string,
  command: CashMutationCommand,
) {
  const route = apiPath(
    `/businesses/${cashUuidSchema.parse(businessId)}/cash-mutation-requests/${cashUuidSchema.parse(requestKey)}`,
  );
  const response = await mainInstance.get<unknown>(route);
  const receipt = cashReceiptSchema.parse(response.data);
  assertReceiptIdentity(businessId, requestKey, command, receipt);
  return receipt;
}

function assertInvoiceFileSize(file: File): void {
  if (file.size < 1) throw new CashCommandValidationError(400);
  if (file.size > maxInvoiceFileBytes) throw new CashCommandValidationError(413);
}

function requestCashMutation(
  businessId: string,
  requestKey: string,
  command: CashMutationCommand,
) {
  if (command.operation === "invoice_ocr_confirm") {
    assertInvoiceFileSize(command.file);
    if (command.fields.items.length < 1 || command.fields.items.length > 500) {
      throw new CashCommandValidationError(400);
    }
    // The Server interprets command as UTF-8 decoded by the multipart parser.
    // Escape a literal replacement character so it remains distinct from invalid UTF-8.
    const json = JSON.stringify({
      ...command.fields,
      business_id: businessId,
      request_key: requestKey,
    }).replaceAll("\uFFFD", "\\uFFFD");
    if (new TextEncoder().encode(json).byteLength > maxOcrCommandBytes) {
      throw new CashCommandValidationError(413);
    }
    const form = new FormData();
    form.append("command", json);
    form.append("file", command.file);
    return mainInstance.post<unknown>(`${invoices}/ocr-confirmations`, form, multipartHeaders);
  }
  if (command.operation === "invoice_create") {
    const payload = { ...command.fields, request_key: requestKey, business_id: businessId };
    if (!command.file) return mainInstance.post<unknown>(invoices, payload);
    assertInvoiceFileSize(command.file);
    const form = new FormData();
    form.append("file", command.file);
    for (const [name, value] of Object.entries(payload)) {
      // A missing folio and JSON null normalize to null on the Server.
      if (value === undefined || (name === "code" && value === null)) continue;
      form.append(name, name === "data" ? JSON.stringify(value) : String(value));
    }
    return mainInstance.post<unknown>(invoices, form, multipartHeaders);
  }
  if (command.operation === "invoice_update") {
    return mainInstance.put<unknown>(
      `${invoices}/${cashCatalogIdSchema.parse(command.id)}`,
      { ...command.fields, request_key: requestKey },
    );
  }
  const category = command.operation === "category_create" || command.operation === "category_update";
  const route = category ? categories : movements;
  const payload = { ...command.fields, request_key: requestKey };
  return "id" in command
    ? mainInstance.put<unknown>(
        `${route}/${(category ? cashCatalogIdSchema : cashUuidSchema).parse(command.id)}`,
        payload,
      )
    : mainInstance.post<unknown>(route, { ...payload, business_id: businessId });
}

export async function sendCashMutation(
  businessId: string,
  requestKey: string,
  command: CashMutationCommand,
) {
  const response = await requestCashMutation(businessId, requestKey, command);
  const result = cashWriteResultSchema.parse(response.data);
  assertReceiptIdentity(businessId, requestKey, command, result);
  if (response.status !== (result.status === "processing" ? 202 : "id" in command ? 200 : 201))
    throw new Error("cash_receipt_status_mismatch");
  return result;
}
