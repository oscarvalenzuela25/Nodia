import { z } from "zod";
import { isFinanceAmount } from "../utils/money";

const id = z.string().refine(isFinanceAmount);
const amount = z.string().refine(isFinanceAmount);
const money = z.string().regex(/^\d+$/);
const signedMoney = z.string().regex(/^-?\d+$/);
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const base = {
  id,
  user_id: id,
  name: z.string().min(1).max(255),
  is_active: z.boolean(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
};
const movementType = z.enum(["income", "expense"]);
const status = z.enum(["pending", "received", "paid", "cancelled"]);
const obligationType = z.enum(["loan", "debt"]);
const categorySummarySchema = z.object({
  id,
  name: z.string(),
  key: z.string(),
  is_active: z.boolean(),
});
export const financeCategorySchema = z.object({
  ...base,
  key: z.string().min(1).max(255),
});
export const financeGroupSchema = z.object({
  ...base,
  key: z.string().min(1).max(255),
  category_count: count,
  categories: z.array(categorySummarySchema).max(100).optional(),
});
export const financeMovementSchema = z
  .object({
    ...base,
    amount,
    type: movementType,
    status,
    category_id: id,
    obligation_id: id.nullable(),
    category: z.object({ id, name: z.string(), key: z.string() }),
    obligation: z
      .object({ id, name: z.string(), type: obligationType })
      .nullable(),
  })
  .refine(
    (value) =>
      value.status === "pending" ||
      value.status === "cancelled" ||
      (value.type === "income"
        ? value.status === "received"
        : value.status === "paid"),
  );
export const financeObligationSchema = z
  .object({
    ...base,
    key: z.string().min(1).max(255),
    type: obligationType,
    amount,
    description: z.string().max(5000).nullable(),
    paid_amount: money,
    remaining_amount: money.nullable(),
    initial_movement: z.object({
      id,
      type: movementType,
      status,
      amount,
      category_id: id,
    }),
  })
  .refine((value) => {
    const initial = value.initial_movement;
    const direction = value.type === "loan" ? "expense" : "income";
    const confirmed = direction === "expense" ? "paid" : "received";
    if (
      initial.type !== direction ||
      (initial.status !== confirmed && initial.status !== "cancelled") ||
      initial.amount !== value.amount
    )
      return false;
    if (initial.status === "cancelled")
      return value.remaining_amount === null && value.paid_amount === "0";
    if (value.remaining_amount === null) return false;
    return (
      /^\d+$/.test(value.amount) &&
      /^\d+$/.test(value.paid_amount) &&
      /^\d+$/.test(value.remaining_amount) &&
      BigInt(value.paid_amount) + BigInt(value.remaining_amount) ===
        BigInt(value.amount)
    );
  });
export const financeRecordSchemas = {
  categories: financeCategorySchema,
  "category-groups": financeGroupSchema,
  movements: financeMovementSchema,
  obligations: financeObligationSchema,
};
export const financePageSchema = <T>(schema: z.ZodType<T>) =>
  z.object({
    data: z.array(schema),
    meta: z.object({
      page: count.min(1),
      limit: count.min(1).max(100),
      total_items: count,
      total_pages: count,
    }),
  });
const active = z.enum(["active", "inactive", "all"]);
export const financeScopeSchema = z.object({
  active,
  movement_filters: z.object({
    q: z.record(z.string(), z.string()),
    category_ids: z.array(id).max(100),
    category_group_ids: z.array(id).max(100),
    obligation_id: id.nullable(),
  }),
  obligation_balances: z.object({
    active,
    repayments: z.literal("all_confirmed_history"),
    includes_inactive_repayments: z.literal(true),
    ignores_movement_filters: z.literal(true),
  }),
});
export const financeOverviewSchema = z.object({
  scope: financeScopeSchema,
  totals: z.object({
    income_amount: money,
    expense_amount: money,
    net_amount: signedMoney,
    movement_count: count,
    pending_count: count,
    cancelled_count: count,
  }),
  counts: z.object({
    categories: count,
    category_groups: count,
    loans: count,
    debts: count,
  }),
  obligations: z.object({
    loan_remaining_amount: money,
    debt_remaining_amount: money,
  }),
});
export const financeSummarySchema = z.object({
  id,
  name: z.string(),
  key: z.string(),
  is_active: z.boolean(),
  movement_count: count,
  income_amount: money,
  expense_amount: money,
  net_amount: signedMoney,
});
export const financeSummaryPageSchema = financePageSchema(
  financeSummarySchema,
).extend({
  scope: financeScopeSchema,
  overlapping_groups: z.literal(true).optional(),
});
