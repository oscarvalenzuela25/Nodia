import { mainInstance } from "../../../config/api";
import { preferenceCatalogSchema, preferenceOptionsQuerySchema, preferenceOptionsSchema, preferencePageSchema, preferencePreparationSchema, preferencePrepareSchema, validPreferenceValue } from "./preferenceSchemas";
import type { NodiaAiPreferenceOptionsQuery, NodiaAiPreferencePrepare } from "./preferenceSchemas";

const base = "/nodia-ai/preferences";
export async function getPreferenceCatalog(signal?: AbortSignal) {
  const { data } = await mainInstance.get<unknown>(`${base}/catalog`, { signal });
  return preferenceCatalogSchema.parse(data);
}
export async function getPreferences(cursor?: string, signal?: AbortSignal) {
  const { data } = await mainInstance.get<unknown>(base, { params: { page_limit: 20, ...(cursor ? { cursor } : {}) }, signal });
  return preferencePageSchema.parse(data);
}
export async function getPreferenceOptions(query: NodiaAiPreferenceOptionsQuery, cursor?: string, signal?: AbortSignal) {
  const params = preferenceOptionsQuerySchema.parse(query);
  const { data } = await mainInstance.get<unknown>(`${base}/options`, { params: { ...params, page_limit: 20, ...(cursor ? { cursor } : {}) }, signal });
  const result = preferenceOptionsSchema.parse(data);
  if (result.items.some(item => !validPreferenceValue({ scope_key: params.scope_key, key: params.key, value_type: params.key === "business_id" ? "uuid" : "bigint", requires_business_scope: params.key === "supplier_id" }, item.id))) throw new Error("nodia_ai:invalid_response");
  return result;
}
export async function preparePreference(input: NodiaAiPreferencePrepare) {
  const body = preferencePrepareSchema.parse(input);
  const { data } = await mainInstance.post<unknown>(`${base}/prepare`, body);
  const result = preferencePreparationSchema.parse(data);
  if (result.proposal && (result.proposal.steps.length !== 1 || result.proposal.steps.some(step => step.tool_name !== `nodia_preferences_prepare_${body.operation}` || step.kind !== "preference_change"
    || body.operation !== "create" && (step.target?.resource_key !== "nodia_ai_preferences" || step.target.id !== body.preference_id)))) throw new Error("nodia_ai:invalid_response");
  return result;
}
