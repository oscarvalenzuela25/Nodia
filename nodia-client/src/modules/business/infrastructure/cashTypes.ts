import type { z } from "zod";
import type {
  cashCategoryListSchema,
  cashCategorySchema,
  cashInvoiceOcrResultSchema,
  cashInvoiceResultSchema,
  cashMonthlySummarySchema,
  cashMovementListSchema,
  cashMovementSchema,
  cashReceiptSchema,
  cashSummarySchema,
  cashWriteResultSchema,
} from "./cashSchemas";
import type { CreateInvoicePayload, UpdateInvoicePayload } from "./types";

export type CashCategory = z.infer<typeof cashCategorySchema>;
export type CashMovement = z.infer<typeof cashMovementSchema>;
export type CashMovementType = CashMovement["type"];
export type CashCategoryList = z.infer<typeof cashCategoryListSchema>;
export type CashMovementList = z.infer<typeof cashMovementListSchema>;
export type CashSummary = z.infer<typeof cashSummarySchema>;
export type CashMonthlySummary = z.infer<typeof cashMonthlySummarySchema>;
export type CashReceipt = z.infer<typeof cashReceiptSchema>;
export type CashWriteResult = z.infer<typeof cashWriteResultSchema>;
export type CashInvoiceResult = z.infer<typeof cashInvoiceResultSchema>;
export type CashInvoiceOcrResult = z.infer<typeof cashInvoiceOcrResultSchema>;

export type CashScope = {
  businessId: string;
  actorId: string;
  sessionVersion: number;
};

type CashPage = { page: number; limit: number };
export type CashCategoryOptions = { search?: string; active?: boolean };
export type CashCategoryFilters = CashPage & CashCategoryOptions;
export type CashMovementFilters = CashPage & {
  search?: string;
  active?: boolean;
  from?: string;
  to?: string;
  categoryId?: string;
  sort?: "occurred_on asc" | "occurred_on desc" | "amount asc" | "amount desc";
};

type CashCategoryFields = Pick<CashCategory, "name" | "description" | "is_active">;
type CashMovementFields = Pick<
  Extract<CashMovement, { source: "manual" }>,
  "category_id" | "amount" | "occurred_on" | "description" | "is_active"
>;
type CashRevision = { expected_version: number };
type CashInvoiceCategory = { cash_category_id?: string | null };

type OcrConfirmationLine = {
  invoice_code: string | null;
  name: string;
  alias: string;
  alias_reviewed: true;
  cost_price: number;
  quantity: number;
};
type OcrProductChanges = {
  code?: string | null;
  name?: string;
  alias?: string;
  cost_price?: number;
  cost_price_tax?: number;
  sale_price?: number;
};
type OcrProductFields = Required<OcrProductChanges> & { is_active: boolean };
type OcrProductTarget = CashRevision & { product_id: string };

export type OcrStockAction = { mode: "add" | "replace"; quantity: number };

export type OcrConfirmationItem = {
  line: OcrConfirmationLine;
  track_stock?: boolean;
  stock_action?: OcrStockAction;
} & (
  | { kind: "create"; product: OcrProductFields & { code: string } }
  | ({ kind: "update"; product: OcrProductFields } & OcrProductTarget)
  | ({ kind: "manual_match"; changes: OcrProductChanges } & OcrProductTarget)
);
export type OcrConfirmationInvoice = CashInvoiceCategory & {
  provider_id?: string | null;
  code?: string | null;
  total_amount: number;
  issue_date?: string | null;
};
export type OcrConfirmationFields = {
  invoice: OcrConfirmationInvoice;
  items: OcrConfirmationItem[];
};

export type CashMutationCommand =
  | {
      operation: "category_create";
      fields: Omit<CashCategoryFields, "is_active"> & { is_active?: boolean };
    }
  | { operation: "category_update"; id: string; fields: CashRevision & Partial<CashCategoryFields> }
  | {
      operation: "movement_create";
      fields: Omit<CashMovementFields, "is_active"> & { type: CashMovementType; is_active?: boolean };
    }
  | { operation: "movement_update"; id: string; fields: CashRevision & Partial<CashMovementFields> }
  | {
      operation: "invoice_create";
      fields: Omit<CreateInvoicePayload, "business_id"> & CashInvoiceCategory;
      file?: File;
    }
  | {
      operation: "invoice_update";
      id: string;
      fields: UpdateInvoicePayload & CashRevision & CashInvoiceCategory;
    }
  | { operation: "invoice_ocr_confirm"; fields: OcrConfirmationFields; file: File };

export type CashMutationOutcome =
  | CashReceipt
  | {
      status: "unavailable";
      request_key: string;
    };
