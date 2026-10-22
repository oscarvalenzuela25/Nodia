import { z } from "zod";
import type { NodiaAiReviewValue } from "./types";

export const cancellationRuleDraftSchema = z.object({ row_id: z.string(), min_days_before: z.string(), refund_percent: z.string() });
export type NodiaAiCancellationRuleDraft = z.infer<typeof cancellationRuleDraftSchema>;

function rules(value: NodiaAiReviewValue): { min_days_before: number; refund_percent: string }[] | null {
  if (!value || typeof value !== "object" || value.kind !== "array" || !value.items.length || value.items.length > 100) return null;
  const result = [];
  for (const item of value.items) {
    if (!item || typeof item !== "object" || item.kind !== "object" || item.fields.length !== 2) return null;
    const days = item.fields.find(field => field.field_key === "min_days_before")?.value;
    const percent = item.fields.find(field => field.field_key === "refund_percent")?.value;
    if (typeof days !== "number" || !Number.isInteger(days) || days < 0 || days > 36500 || typeof percent !== "string"
      || !/^(?:0|[1-9]\d?|100)(?:\.\d{1,2})?$/.test(percent) || Number(percent) > 100) return null;
    result.push({ min_days_before: days, refund_percent: percent });
  }
  return result.some(rule => rule.min_days_before === 0) && new Set(result.map(rule => rule.min_days_before)).size === result.length ? result : null;
}
export const validNodiaAiCancellationRules = (value: NodiaAiReviewValue) => rules(value) !== null;
export function cancellationRuleDrafts(value: NodiaAiReviewValue): NodiaAiCancellationRuleDraft[] {
  return (rules(value) ?? []).map(rule => ({ row_id: crypto.randomUUID(), min_days_before: String(rule.min_days_before), refund_percent: rule.refund_percent }));
}
export function cancellationRulesValue(input: unknown[]): NodiaAiReviewValue | undefined {
  const parsed = z.array(cancellationRuleDraftSchema).safeParse(input);
  if (!parsed.success) return undefined;
  const drafts = parsed.data;
  if (drafts.some(rule => !/^\d+$/.test(rule.min_days_before))) return undefined;
  const value: NodiaAiReviewValue = { kind: "array", items: drafts.map(rule => ({ kind: "object", fields: [
    { field_key: "min_days_before", value: Number(rule.min_days_before) }, { field_key: "refund_percent", value: rule.refund_percent },
  ] })) };
  return validNodiaAiCancellationRules(value) ? value : undefined;
}
