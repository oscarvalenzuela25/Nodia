import type { z } from "zod";
import type {
  cashCategoryListSchema,
  cashCategorySchema,
  cashMovementListSchema,
  cashMovementSchema,
  cashReceiptSchema,
  cashSummarySchema,
  cashWriteResultSchema,
} from "./cashSchemas";

export type CashCategory = z.infer<typeof cashCategorySchema>;
export type CashMovement = z.infer<typeof cashMovementSchema>;
export type CashMovementType = CashMovement["type"];
export type CashCategoryList = z.infer<typeof cashCategoryListSchema>;
export type CashMovementList = z.infer<typeof cashMovementListSchema>;
export type CashSummary = z.infer<typeof cashSummarySchema>;
export type CashReceipt = z.infer<typeof cashReceiptSchema>;
export type CashWriteResult = z.infer<typeof cashWriteResultSchema>;

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
  | { operation: "movement_update"; id: string; fields: CashRevision & Partial<CashMovementFields> };

export type CashMutationOutcome =
  | CashReceipt
  | {
      status: "unavailable";
      request_key: string;
    };
