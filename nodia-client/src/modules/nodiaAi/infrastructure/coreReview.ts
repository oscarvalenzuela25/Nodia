import { z } from "zod";
import type { NodiaAiReviewValue } from "./types";

export const coreTranslationDraftSchema = z.object({ row_id: z.string(), key: z.string(), es: z.string(), en: z.string() });
export type CoreTranslationDraft = z.infer<typeof coreTranslationDraftSchema>;
export const validCoreId = (value: string) => /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;
export function coreIdDrafts(value: NodiaAiReviewValue): string[] {
  return value && typeof value === "object" && value.kind === "array" && value.items.every(item => typeof item === "string") ? value.items as string[] : [];
}
export function coreIdsValue(value: unknown[]): NodiaAiReviewValue | undefined {
  return value.every(item => typeof item === "string" && validCoreId(item)) && new Set(value).size === value.length
    ? { kind: "array", items: value as string[] } : undefined;
}
export function coreTranslationDrafts(value: NodiaAiReviewValue): CoreTranslationDraft[] {
  if (!value || typeof value !== "object" || value.kind !== "array") return [];
  return value.items.flatMap(item => {
    if (!item || typeof item !== "object" || item.kind !== "object") return [];
    const entries = Object.fromEntries(item.fields.map(field => [field.field_key, field.value]));
    return ["key", "es", "en"].every(key => typeof entries[key] === "string")
      ? [{ row_id: crypto.randomUUID(), key: entries.key as string, es: entries.es as string, en: entries.en as string }] : [];
  });
}
export function coreTranslationsValue(value: unknown[]): NodiaAiReviewValue | undefined {
  const parsed = z.array(coreTranslationDraftSchema).safeParse(value);
  const size = (value: string) => new TextEncoder().encode(value).length;
  if (!parsed.success || parsed.data.some(row => !row.key.trim() || !row.es.trim() || !row.en.trim() || size(row.key) > 255 || size(row.es) > 5000 || size(row.en) > 5000) || new Set(parsed.data.map(row => row.key)).size !== parsed.data.length) return undefined;
  return { kind: "array", items: parsed.data.map(row => ({ kind: "object", fields: ["key", "es", "en"].map(key => ({ field_key: key, value: row[key as "key" | "es" | "en"] })) })) };
}
export function validCoreReviewValue(kind: "core_id_list" | "core_translations", value: NodiaAiReviewValue | undefined): boolean {
  if (!value || typeof value !== "object" || value.kind !== "array" || value.items.length > 100) return false;
  if (kind === "core_id_list") return coreIdsValue(value.items) !== undefined;
  return value.items.every(item => item && typeof item === "object" && item.kind === "object" && item.fields.length === 3 && new Set(item.fields.map(field => field.field_key)).size === 3 && item.fields.every(field => ["key", "es", "en"].includes(field.field_key) && typeof field.value === "string"))
    && coreTranslationsValue(coreTranslationDrafts(value)) !== undefined;
}
export function coreAssociationOptions(value: NodiaAiReviewValue | undefined): { value: string; label: string }[] {
  if (!value || typeof value !== "object" || value.kind !== "array") return [];
  return value.items.flatMap(item => {
    if (!item || typeof item !== "object" || item.kind !== "object") return [];
    const id = item.fields.find(field => field.field_key === "id")?.value;
    const label = item.fields.find(field => field.field_key === "label" || field.field_key === "name" || field.field_key === "key")?.value;
    return typeof id === "string" && validCoreId(id) ? [{ value: id, label: typeof label === "string" ? `${label} · ${id}` : id }] : [];
  });
}
/** Public object field order is presentation, not a user edit. Array order remains exact. */
export function sameCoreReviewValue(left: NodiaAiReviewValue, right: NodiaAiReviewValue | undefined): boolean {
  if (left === right) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object" || left.kind !== right.kind) return false;
  if (left.kind === "array" && right.kind === "array") return left.items.length === right.items.length && left.items.every((item, index) => sameCoreReviewValue(item, right.items[index]));
  if (left.kind === "object" && right.kind === "object") return left.fields.length === right.fields.length && left.fields.every(field => sameCoreReviewValue(field.value, right.fields.find(item => item.field_key === field.field_key)?.value));
  return false;
}
