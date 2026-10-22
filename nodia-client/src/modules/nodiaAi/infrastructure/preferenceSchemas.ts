import { z } from "zod";
import { nodiaAiApiErrorSchema, nodiaAiProposalSchema } from "./schemas";

export const preferenceScopeKeySchema = z.enum(["finance", "business", "rental"]);
export const preferenceKeySchema = z.enum(["expense_category_id", "income_category_id", "business_id", "supplier_id", "property_id"]);
const bigint = z.string().regex(/^[1-9]\d{0,18}$/).refine(value => BigInt(value) <= 9223372036854775807n);
const scope = z.object({ business_id: z.uuid().optional() }).strict();
const definition = z.object({ scope_key: preferenceScopeKeySchema, key: preferenceKeySchema, value_type: z.enum(["uuid", "bigint"]), requires_business_scope: z.boolean() }).strict()
  .refine(item => (item.key === "business_id" || item.key === "supplier_id" ? item.scope_key === "business" : item.key === "property_id" ? item.scope_key === "rental" : item.scope_key === "finance")
    && item.value_type === (item.key === "business_id" ? "uuid" : "bigint") && item.requires_business_scope === (item.key === "supplier_id"));
export const preferenceCatalogSchema = z.object({ items: z.array(definition) }).strict();
export const preferenceSchema = z.object({ preference_id: z.uuid(), scope_key: preferenceScopeKeySchema, key: preferenceKeySchema, scope,
  value: z.string().min(1), revision: z.number().int().positive().max(2147483646), value_label: z.string().nullable(), scope_label: z.string().nullable(), available: z.boolean(),
}).strict().refine(item => definition.safeParse({ scope_key: item.scope_key, key: item.key, value_type: item.key === "business_id" ? "uuid" : "bigint", requires_business_scope: item.key === "supplier_id" }).success
  && (item.key === "supplier_id" ? Boolean(item.scope.business_id) : !item.scope.business_id)
  && (item.key === "business_id" ? z.uuid() : bigint).safeParse(item.value).success
  && (item.available || item.value_label === null && item.scope_label === null));
const cursor = z.string().min(1).max(2048).nullable();
export const preferencePageSchema = z.object({ items: z.array(preferenceSchema), next_cursor: cursor }).strict();
export const preferenceOptionsSchema = z.object({ items: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) }).strict()), next_cursor: cursor }).strict();
export const preferenceOptionsQuerySchema = z.object({ scope_key: preferenceScopeKeySchema, key: preferenceKeySchema, business_id: z.uuid().optional(), for_supplier_scope: z.boolean().optional(), search: z.string().refine(value => Boolean(value.trim()) && new TextEncoder().encode(value).length <= 128).optional() }).strict()
  .refine(item => item.for_supplier_scope === undefined || item.scope_key === "business" && item.key === "business_id");
const create = z.object({ conversation_id: z.uuid(), operation: z.literal("create"), scope_key: preferenceScopeKeySchema, key: preferenceKeySchema, scope, value: z.string().min(1) }).strict().refine(item => {
  const parsed = definition.safeParse({ scope_key: item.scope_key, key: item.key, value_type: item.key === "business_id" ? "uuid" : "bigint", requires_business_scope: item.key === "supplier_id" });
  return parsed.success && validPreferenceValue(parsed.data, item.value) && (parsed.data.requires_business_scope ? Boolean(item.scope.business_id) : !item.scope.business_id);
});
const update = z.object({ conversation_id: z.uuid(), operation: z.literal("update"), preference_id: z.uuid(), expected_revision: z.number().int().positive(), value: z.string().min(1) }).strict();
const remove = z.object({ conversation_id: z.uuid(), operation: z.literal("delete"), preference_id: z.uuid(), expected_revision: z.number().int().positive() }).strict();
export const preferencePrepareSchema = z.discriminatedUnion("operation", [create, update, remove]);
export const preferencePreparationSchema = z.object({ status: z.enum(["ready", "needs_clarification", "blocked"]), draft_id: z.uuid().nullable(), proposal: nodiaAiProposalSchema.nullable(),
  missing_fields: z.array(z.string().min(1)), clarification_keys: z.array(z.string().min(1)), error: nodiaAiApiErrorSchema.nullable(),
}).strict().refine(result => result.status !== "ready" || result.proposal !== null);

export type NodiaAiPreference = z.infer<typeof preferenceSchema>;
export type NodiaAiPreferenceDefinition = z.infer<typeof definition>;
export type NodiaAiPreferenceOptionsQuery = z.infer<typeof preferenceOptionsQuerySchema>;
export type NodiaAiPreferencePrepare = z.infer<typeof preferencePrepareSchema>;
export function validPreferenceValue(definition: NodiaAiPreferenceDefinition, value: string): boolean {
  return (definition.value_type === "uuid" ? z.uuid() : bigint).safeParse(value).success;
}
