import { useEffect, useState } from "react";
import { Alert, Box, Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import { preferenceKeySchema, preferenceScopeKeySchema } from "../../infrastructure/preferenceSchemas";
import { usePreferenceOptions } from "../../infrastructure/usePreferences";
import type { NodiaAiPublicProposal } from "../../infrastructure/types";

/** Names are discovered again; immutable proposal fields provide the exact scope. */
export default function PreferenceValueEditor({ proposal, stepId, value, onChange, disabled, label, error, observed = true }: {
  proposal: NodiaAiPublicProposal; stepId: string; value: string; onChange: (value: string | null) => void; disabled: boolean; label: string; error: boolean; observed?: boolean;
}) {
  const { t } = useTranslation("nodiaAi");
  const step = proposal.steps.find(item => item.step_id === stepId);
  const get = (key: string) => step?.changes.find(change => change.field_key === key)?.after;
  const scopeKey = preferenceScopeKeySchema.safeParse(get("scope_key"));
  const key = preferenceKeySchema.safeParse(get("key"));
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const timer = setTimeout(() => setDebounced(search), 250); return () => clearTimeout(timer); }, [search]);
  const query = usePreferenceOptions(scopeKey.success && key.success ? { scope_key: scopeKey.data, key: key.data,
    ...(key.data === "supplier_id" && step?.scope.business_id ? { business_id: step.scope.business_id } : {}), ...(debounced ? { search: debounced } : {}) } : null, observed);
  const options = query.isError ? [] : query.data?.pages.flatMap(page => page.items) ?? [];
  const currentLabel = get("value_label");
  const items = options.map(item => ({ value: item.id, label: item.label }));
  if (!query.isError && typeof currentLabel === "string" && value === get("value") && !items.some(item => item.value === value)) items.unshift({ value, label: currentLabel });
  return <Box sx={{ minWidth: 0 }}>
    {query.isError && <Alert severity="error" action={<Button variant="contained" disabled={query.isFetching || disabled} onClick={() => void query.refetch()}>{t("retry")}</Button>}>{t("preferences.options_error")}</Alert>}
    <SelectSingleInput label={label} value={query.isError ? null : value || null} options={items} onChange={onChange} clearable={false} disabled={disabled || query.isFetching || query.isError || !scopeKey.success || !key.success}
      error={error} onSearchChange={setSearch} loadingOptions={query.isFetching} hasMore={query.hasNextPage} onLoadMore={() => { if (!query.isFetching) void query.fetchNextPage(); }} />
  </Box>;
}
