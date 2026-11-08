import { z } from "zod";
import { editableQuantitySchema, measurementUnitSchema, paymentMethodSchema, positiveQuantitySchema, saleSchema } from "../modules/business/infrastructure/salesSchemas";
import { cartTotal } from "../modules/business/infrastructure/salesPolicies";
import type { CartLine, PaymentMethod, Sale } from "../modules/business/infrastructure/salesTypes";
import type { SaleJournal } from "./businessSaleRecoveryStorage";

export interface SaleWorkspaceSession {
  id: string;
  number: number;
  sale: Sale | null;
  lines: CartLine[];
  paymentMethod: PaymentMethod;
  description: string;
  dirty: boolean;
  pending: SaleJournal | null;
  quantityDrafts: Record<string, string>;
  barcode: string;
}

export interface SaleWorkspaceSnapshot {
  version: 2;
  actorId: string;
  businessId: string;
  activeId: string;
  nextNumber: number;
  sessions: SaleWorkspaceSession[];
}

// The existing auth cleanup clears this entire prefix, including legacy journals.
const PREFIX = "nodia:sale-recovery:workspace:v2:";
const LEGACY_PREFIX = "nodia:sale-recovery:workspace:v1:";
const positiveInteger = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const amount = z.string().regex(/^(0|[1-9]\d*)$/);
const lineCommand = z.object({
  product_id: z.string().min(1),
  quantity: positiveQuantitySchema,
  expected_product_version: positiveInteger,
  expected_unit_price: amount,
  unit_price_override: amount.nullable().optional(),
}).strict();
const line = lineCommand.extend({
  quantity: editableQuantitySchema,
  name: z.string(), code: z.string().nullable(), barcode: z.string().nullable(), measurement_unit: measurementUnitSchema.optional(),
  regular_price: amount, offer_price: amount.nullable(), price_source: z.enum(["regular", "offer"]),
});
const mutation = z.object({
  operation: z.enum(["create", "update", "checkout", "complete", "cancel", "discard"]),
  saleId: z.string().min(1).optional(),
  command: z.object({
    request_key: z.string().min(1), expected_version: positiveInteger.optional(),
    items: z.array(lineCommand).max(200).optional(), payment_method: paymentMethodSchema.optional(),
    payment_method_description: z.string().nullable().optional(), cancellation_reason: z.string().optional(),
  }).strict(),
}).strict();
const journal = z.object({ actorId: z.string().min(1), businessId: z.string().min(1), mutation }).strict();
const session = z.object({
  id: z.string().min(1), number: positiveInteger, sale: saleSchema.nullable(), lines: z.array(line).max(200),
  paymentMethod: paymentMethodSchema, description: z.string(), dirty: z.boolean(), pending: journal.nullable(),
  quantityDrafts: z.record(z.string(), z.string()), barcode: z.string(),
}).strict();
const snapshot = z.object({
  version: z.literal(2), actorId: z.string().min(1), businessId: z.string().min(1), activeId: z.string().min(1),
  nextNumber: positiveInteger, sessions: z.array(session).min(1),
}).strict();

export const saleWorkspaceKey = (actorId: string, businessId: string) =>
  `${PREFIX}${encodeURIComponent(actorId)}:${encodeURIComponent(businessId)}`;

function parseWorkspace(value: unknown, actorId: string, businessId: string): SaleWorkspaceSnapshot {
  try {
    const result = snapshot.parse(value);
    const ids = new Set(result.sessions.map((entry) => entry.id));
    const numbers = new Set(result.sessions.map((entry) => entry.number));
    if (result.actorId !== actorId || result.businessId !== businessId || ids.size !== result.sessions.length ||
      numbers.size !== result.sessions.length || !ids.has(result.activeId) ||
      result.sessions.some((entry) => entry.number >= result.nextNumber || (entry.sale && entry.sale.business_id !== businessId) ||
        (entry.pending && (entry.pending.actorId !== actorId || entry.pending.businessId !== businessId)))) throw new Error("invalid_workspace");
    const requestKeys = result.sessions.flatMap((entry) => entry.pending ? [entry.pending.mutation.command.request_key] : []);
    if (new Set(requestKeys).size !== requestKeys.length) throw new Error("invalid_workspace");
    for (const entry of result.sessions) {
      cartTotal(entry.lines);
      if (new Set(entry.lines.map((item) => item.product_id)).size !== entry.lines.length) throw new Error("invalid_workspace");
    }
    return result;
  } catch {
    throw new Error("invalid_workspace");
  }
}

function readRaw(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { throw new Error("storage_unavailable"); }
}

export function loadSaleWorkspace(actorId: string, businessId: string): SaleWorkspaceSnapshot | null {
  const raw = readRaw(saleWorkspaceKey(actorId, businessId));
  if (raw === null) {
    const legacy = readRaw(`${LEGACY_PREFIX}${encodeURIComponent(actorId)}:${encodeURIComponent(businessId)}`);
    if (legacy === null) return null;
    try {
      const decoded: unknown = JSON.parse(legacy);
      if (!decoded || typeof decoded !== "object" || !("version" in decoded) || decoded.version !== 1) throw new Error("invalid_workspace");
      return parseWorkspace({ ...decoded, version: 2 }, actorId, businessId);
    } catch { throw new Error("invalid_workspace"); }
  }
  try { return parseWorkspace(JSON.parse(raw), actorId, businessId); } catch { throw new Error("invalid_workspace"); }
}

/** A single setItem commits the carts and their recovery identities together. */
export function writeSaleWorkspace(value: SaleWorkspaceSnapshot): void {
  const validated = parseWorkspace(value, value.actorId, value.businessId);
  const key = saleWorkspaceKey(value.actorId, value.businessId);
  const previous = readRaw(key);
  if (previous !== null) {
    try { parseWorkspace(JSON.parse(previous), value.actorId, value.businessId); } catch { throw new Error("invalid_workspace"); }
  }
  try {
    sessionStorage.setItem(key, JSON.stringify(validated));
    sessionStorage.removeItem(`${LEGACY_PREFIX}${encodeURIComponent(value.actorId)}:${encodeURIComponent(value.businessId)}`);
  } catch { throw new Error("storage_unavailable"); }
}
