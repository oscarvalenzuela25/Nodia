import { z } from "zod";
import type { CashCategory, CashMutationCommand } from "../../../../../../infrastructure/cashTypes";
import type { InvoiceEditSource } from "../../../../../../infrastructure/services";

export const MAX_INVOICE_TOTAL = 2147483647;

export const invoiceSchema = z.object({
  code: z.string().trim().max(255, "business:invoice_code_invalid"),
  provider_id: z.string().nullable().optional(),
  total_amount: z.number({ error: "business:invoice_validation_total" })
    .int("business:invoice_validation_total")
    .min(0, "business:invoice_validation_total")
    .max(MAX_INVOICE_TOTAL, "business:invoice_validation_total"),
  path_storage: z.string(),
  issue_date: z.string(),
  notes: z.string(),
  is_active: z.boolean(),
});

export type InvoiceFormData = z.infer<typeof invoiceSchema>;
export type InvoiceFormSubmitData = InvoiceFormData & {
  file?: File | null;
  cashCategory?: Pick<CashCategory, "id" | "name" | "is_active"> | null;
};

export type InvoiceFormSource = Pick<
  InvoiceEditSource, "code" | "provider_id" | "total_amount" | "path_storage" | "data" | "is_active" | "provider"
> & Partial<Pick<InvoiceEditSource, "cash_expense">>;

export function toInvoiceFormData(invoice: InvoiceFormSource): InvoiceFormData {
  const { issue_date, notes } = invoice.data ?? {};
  return {
    code: invoice.code ?? "",
    provider_id: invoice.provider_id ?? null,
    total_amount: invoice.total_amount,
    path_storage: invoice.path_storage,
    issue_date: typeof issue_date === "string" ? issue_date : "",
    notes: typeof notes === "string" ? notes : "",
    is_active: invoice.is_active,
  };
}

export function buildInvoiceCommand(
  form: InvoiceFormSubmitData,
  base?: InvoiceEditSource,
): Extract<CashMutationCommand, { operation: "invoice_create" | "invoice_update" }> {
  const code = form.code.trim() || null;
  const provider_id = form.provider_id || null;
  const { total_amount, path_storage, is_active, issue_date, notes, cashCategory } = form;
  const currentCategoryId = base?.cash_expense?.category.id ?? null;
  const nextCategoryId = cashCategory && cashCategory.id;
  const cashPatch = nextCategoryId === null || (nextCategoryId !== undefined && nextCategoryId !== currentCategoryId)
    ? { cash_category_id: nextCategoryId }
    : {};
  if (!base) {
    return {
      operation: "invoice_create",
      ...(form.file ? { file: form.file } : {}),
      fields: {
        code, provider_id, total_amount, path_storage, is_active,
        data: { issue_date, notes },
        ...cashPatch,
      },
    };
  }
  const fields = toInvoiceFormData(base);
  const changedDate = issue_date !== fields.issue_date;
  const changedNotes = notes !== fields.notes;
  return {
    operation: "invoice_update",
    id: base.id,
    fields: {
      expected_version: base.version,
      ...(code === (fields.code.trim() || null) ? {} : { code }),
      ...(provider_id === fields.provider_id ? {} : { provider_id }),
      ...(total_amount === fields.total_amount ? {} : { total_amount }),
      ...(path_storage === fields.path_storage ? {} : { path_storage }),
      ...(is_active === fields.is_active ? {} : { is_active }),
      ...(changedDate || changedNotes ? {
        data: {
          ...base.data,
          ...(changedDate ? { issue_date } : {}),
          ...(changedNotes ? { notes } : {}),
        },
      } : {}),
      ...cashPatch,
    },
  };
}
