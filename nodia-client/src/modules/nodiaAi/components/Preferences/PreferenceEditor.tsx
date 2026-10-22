import { useEffect, useState } from "react";
import { Alert, Box, Button } from "@mui/material";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import { usePreferenceOptions } from "../../infrastructure/usePreferences";
import { validPreferenceValue } from "../../infrastructure/preferenceSchemas";
import type { NodiaAiPreference, NodiaAiPreferenceDefinition, NodiaAiPreferencePrepare } from "../../infrastructure/preferenceSchemas";
import { Actions } from "./styles";

const formSchema = z.object({ definition: z.string().min(1), business_id: z.string().nullable(), value: z.string().min(1) });
type Form = z.infer<typeof formSchema>;
const identity = (definition: NodiaAiPreferenceDefinition) => `${definition.scope_key}:${definition.key}`;
export default function PreferenceEditor({ definitions, preference, conversationId, disabled, active, onPrepare, onCancel }: {
  definitions: NodiaAiPreferenceDefinition[]; preference?: NodiaAiPreference; conversationId: string; disabled: boolean; active: boolean;
  onPrepare: (input: NodiaAiPreferencePrepare) => Promise<void>; onCancel: () => void;
}) {
  const { t } = useTranslation("nodiaAi");
  const form = useForm<Form>({ resolver: zodResolver(formSchema), defaultValues: { definition: preference ? `${preference.scope_key}:${preference.key}` : "", business_id: preference?.scope.business_id ?? null, value: preference?.value ?? "" } });
  const values = useWatch({ control: form.control });
  const definition = definitions.find(item => identity(item) === values.definition);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const timer = setTimeout(() => setDebounced(search), 250); return () => clearTimeout(timer); }, [search]);
  const businesses = usePreferenceOptions({ scope_key: "business", key: "business_id", for_supplier_scope: true }, active && definition?.requires_business_scope === true && !preference);
  const options = usePreferenceOptions(definition && (!definition.requires_business_scope || values.business_id) ? { scope_key: definition.scope_key, key: definition.key,
    ...(definition.requires_business_scope ? { business_id: values.business_id! } : {}), ...(debounced ? { search: debounced } : {}) } : null, active);
  const optionItems = options.isError ? [] : options.data?.pages.flatMap(page => page.items) ?? [];
  const businessItems = businesses.isError ? [] : businesses.data?.pages.flatMap(page => page.items) ?? [];
  const busy = disabled || form.formState.isSubmitting || options.isFetching || businesses.isFetching;
  const submit = form.handleSubmit(async value => {
    if (!definition || !validPreferenceValue(definition, value.value) || options.isError) return;
    await onPrepare(preference ? { conversation_id: conversationId, operation: "update", preference_id: preference.preference_id, expected_revision: preference.revision, value: value.value }
      : { conversation_id: conversationId, operation: "create", scope_key: definition.scope_key, key: definition.key, scope: definition.requires_business_scope ? { business_id: value.business_id! } : {}, value: value.value });
  });
  return <Box component="form" onSubmit={event => { event.preventDefault(); if (!busy) void submit(); }} sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
    <Controller control={form.control} name="definition" render={({ field }) => <SelectSingleInput label={t("preferences.kind")} options={definitions.map(item => ({ value: identity(item), label: t(`preferences.keys.${item.key}`) }))} value={field.value || null} clearable={false} disabled={busy || Boolean(preference)} onChange={value => { field.onChange(value ?? ""); form.setValue("value", ""); form.setValue("business_id", null); setSearch(""); }} />} />
    {definition?.requires_business_scope && <Controller control={form.control} name="business_id" render={({ field }) => <SelectSingleInput label={t("preferences.business_scope")} value={field.value ?? null} options={preference?.scope.business_id && preference.scope_label ? [{ value: preference.scope.business_id, label: preference.scope_label }] : businessItems.map(item => ({ value: item.id, label: item.label }))} disabled={busy || Boolean(preference) || businesses.isError} clearable={false} onChange={value => { field.onChange(value); form.setValue("value", ""); }} hasMore={businesses.hasNextPage} onLoadMore={() => { if (!businesses.isFetching) void businesses.fetchNextPage(); }} loadingOptions={businesses.isFetching} />} />}
    {(options.isError || businesses.isError) && <Alert severity="error" action={<Button disabled={busy} onClick={() => { if (options.isError) void options.refetch(); if (businesses.isError) void businesses.refetch(); }}>{t("retry")}</Button>}>{t("preferences.options_error")}</Alert>}
    <Controller control={form.control} name="value" render={({ field, fieldState }) => <SelectSingleInput label={t("preferences.value")} value={options.isError ? null : field.value || null} options={optionItems.map(item => ({ value: item.id, label: item.label }))} disabled={busy || !definition || options.isError || definition.requires_business_scope && !values.business_id} required clearable={false} onChange={field.onChange} onSearchChange={setSearch} hasMore={options.hasNextPage} onLoadMore={() => { if (!options.isFetching) void options.fetchNextPage(); }} loadingOptions={options.isFetching} error={Boolean(fieldState.error)} helperText={fieldState.error ? t("preferences.choose_value") : undefined} />} />
    {definition && !options.isFetching && !options.isError && !optionItems.length && <Alert severity="info">{t("preferences.no_options")}</Alert>}
    <Actions><Button type="submit" variant="contained" disabled={busy || !definition || !values.value || options.isError || Boolean(values.value && definition && !validPreferenceValue(definition, values.value))}>{t("preferences.prepare")}</Button><Button disabled={busy} onClick={onCancel}>{t("preferences.cancel_editor")}</Button></Actions>
  </Box>;
}
