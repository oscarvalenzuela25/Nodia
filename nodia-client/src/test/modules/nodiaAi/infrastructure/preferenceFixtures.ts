import { proposal as original } from "./proposalFixtures";
import { chatId } from "./fixtures";
import type { NodiaAiPreference, NodiaAiPreferenceDefinition, NodiaAiPreferencePrepare } from "../../../../modules/nodiaAi/infrastructure/preferenceSchemas";
export const catalog: { items: NodiaAiPreferenceDefinition[] } = { items: [
  { scope_key: "finance", key: "expense_category_id", value_type: "bigint", requires_business_scope: false },
  { scope_key: "finance", key: "income_category_id", value_type: "bigint", requires_business_scope: false },
  { scope_key: "business", key: "business_id", value_type: "uuid", requires_business_scope: false },
  { scope_key: "business", key: "supplier_id", value_type: "bigint", requires_business_scope: true },
  { scope_key: "rental", key: "property_id", value_type: "bigint", requires_business_scope: false },
] };
export const preference: NodiaAiPreference = { preference_id: "99999999-9999-4999-8999-999999999999", scope_key: "finance", key: "expense_category_id", scope: {}, value: "9007199254740993", revision: 3, value_label: "Synthetic food", scope_label: null, available: true };
export const createInput: Extract<NodiaAiPreferencePrepare, { operation: "create" }> = { conversation_id: chatId, operation: "create", scope_key: "finance", key: "expense_category_id", scope: {}, value: preference.value };
export const preferenceProposal = { ...original, steps: [{ ...original.steps[0], tool_name: "nodia_preferences_prepare_create", kind: "preference_change" as const,
  changes: Object.entries({ scope_key: "finance", key: "expense_category_id", business_id: null, value: preference.value, value_label: "Synthetic food", scope_label: null }).map(([field_key, after]) => ({ field_key, after, before: null, before_present: false, after_present: true, origin: "user" as const })),
}] };
export const prepared = { status: "ready" as const, draft_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", proposal: preferenceProposal, missing_fields: [], clarification_keys: [], error: null };
