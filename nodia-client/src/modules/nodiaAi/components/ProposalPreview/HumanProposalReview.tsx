import { parseNodiaAiInteger } from "../../infrastructure/integerReview";
import { useEffect, useState } from "react";
import PreferenceValueEditor from "../Preferences/PreferenceValueEditor";
import { Alert, Box, Button, FormControlLabel, Switch, Typography } from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import { useHumanProposal } from "../../infrastructure/useHumanProposal";
import type { NodiaAiEditableField, NodiaAiProposalReview, NodiaAiPublicProposal } from "../../infrastructure/types";
import { ReviewActions, SwitchWrapper } from "./styles";
import ConfirmedExecution from "../ConfirmedExecution";
import CancellationRulesEditor from "./CancellationRulesEditor";
import { cancellationRuleDraftSchema, cancellationRuleDrafts, cancellationRulesValue } from "../../infrastructure/cancellationRulesReview";
import DateInput from "../../../../components/inputs/DateInput";
import TimeInput from "../../../../components/inputs/TimeInput";
import DateTimeInput from "../../../../components/inputs/DateTimeInput";
import { rentalReviewTimezone, rentalTemporalKind, validRentalTemporalDraft } from "../../infrastructure/rentalReview";
import { nodiaAiProviderTool } from "../../infrastructure/aiProviderPresentation";

import CoreTranslationsEditor from "./CoreTranslationsEditor";
import CoreAssociationsEditor from "./CoreAssociationsEditor";
import { coreAssociationOptions, coreTranslationDraftSchema, coreTranslationDrafts, coreTranslationsValue, coreIdDrafts, coreIdsValue, sameCoreReviewValue } from "../../infrastructure/coreReview";

const valueOf = (proposal: NodiaAiPublicProposal, field: NodiaAiEditableField) =>
  proposal.steps.find(step => step.step_id === field.step_id)?.changes.find(change => change.field_key === field.field_key)?.after;
// Registered keys are identities, never React Hook Form paths. The encoding also
// keeps edits attached to their field if metadata is returned in another order.
const formKey = (field: NodiaAiEditableField) => `f${field.step_id.replaceAll("-", "")}_${Array.from(new TextEncoder().encode(field.field_key), byte => byte.toString(16).padStart(2, "0")).join("")}`;

export default function HumanProposalReview({ conversationId, proposal, metadata, onRevision, disabled, observed = true, onBusyChange }: {
  conversationId: string; proposal: NodiaAiPublicProposal; metadata: NodiaAiProposalReview;
  onRevision: (proposal: NodiaAiPublicProposal) => void; disabled: boolean; observed?: boolean; onBusyChange?: (busy: boolean) => void;
}) {
  const { t, i18n } = useTranslation("nodiaAi");
  const [editing, setEditing] = useState(false);
  const action = useHumanProposal(conversationId, proposal, onRevision);
  useEffect(() => { onBusyChange?.(disabled || action.busy || Boolean(action.uncertain)); return () => onBusyChange?.(false); }, [disabled, action.busy, action.uncertain, onBusyChange]);
  const fields = metadata.editable_fields;
  const label = (key: string) => i18n.exists(key) ? i18n.t(key) : key;
  const schema = z.object({ values: z.record(z.string(), z.union([z.string(), z.boolean(), z.null(), z.array(cancellationRuleDraftSchema), z.array(coreTranslationDraftSchema), z.array(z.string())])) }).superRefine((form, context) => {
    fields.forEach(field => {
      const value = form.values[formKey(field)];
      let invalid: boolean;
      if (value === null) invalid = !field.nullable;
      else if (["core_id_list", "core_translations"].includes(field.kind)) invalid = !Array.isArray(value) || (field.kind === "core_id_list" ? coreIdsValue(value) : coreTranslationsValue(value)) === undefined || field.minimum !== null && BigInt(value.length) < BigInt(field.minimum) || field.maximum !== null && BigInt(value.length) > BigInt(field.maximum);
      else if (field.kind === "rental_cancellation_rules") invalid = !Array.isArray(value) || cancellationRulesValue(value) === undefined;
      else if (field.kind === "boolean") invalid = typeof value !== "boolean";
      else if (typeof value !== "string") invalid = true;
      else if (field.kind === "text") {
        const provider = nodiaAiProviderTool(proposal.steps.find(step => step.step_id === field.step_id)?.tool_name ?? "");
        invalid = (provider || !field.nullable) && !value.trim() || field.max_length !== null && (provider ? new TextEncoder().encode(value).length : Array.from(field.nullable ? value : value.trim()).length) > field.max_length;
      }
      else if (field.kind === "integer") invalid = parseNodiaAiInteger(value, field.minimum, field.maximum) === null;
      else if (field.kind === "enum") invalid = !field.options.some(option => option.value === value);
      else invalid = !/^(?:0|[1-9]\d*)$/.test(value) || field.minimum !== null && BigInt(value) < BigInt(field.minimum) || field.maximum !== null && BigInt(value) > BigInt(field.maximum);
      const temporal = rentalTemporalKind(proposal, field);
      if (temporal && value !== null) invalid ||= typeof value !== "string" || !validRentalTemporalDraft(temporal, value) || temporal === "instant" && rentalReviewTimezone(proposal, field) === null;
      if (invalid) context.addIssue({ code: "custom", path: ["values", formKey(field)], message: "proposal.invalid_field" });
    });
  });
  const defaults = Object.fromEntries(fields.map(field => [formKey(field), field.kind === "core_id_list" ? coreIdDrafts(valueOf(proposal, field) ?? null) : field.kind === "core_translations" ? coreTranslationDrafts(valueOf(proposal, field) ?? null) : field.kind === "rental_cancellation_rules" ? cancellationRuleDrafts(valueOf(proposal, field) ?? null) : field.kind === "integer" && valueOf(proposal, field) !== null ? String(valueOf(proposal, field)) : valueOf(proposal, field) as string | boolean | null]));
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { values: defaults } });
  const busy = disabled || action.busy;
  const readonly = metadata.read_only || proposal.state !== "ready";
  const save = form.handleSubmit(async data => {
    const edits = fields.flatMap(field => {
      const draft = data.values[formKey(field)];
      const value = field.kind === "core_id_list" && Array.isArray(draft) ? coreIdsValue(draft) : field.kind === "core_translations" && Array.isArray(draft) ? coreTranslationsValue(draft) : field.kind === "rental_cancellation_rules" && Array.isArray(draft) ? cancellationRulesValue(draft) : field.kind === "integer" && draft !== null ? parseNodiaAiInteger(draft, field.minimum, field.maximum) : Array.isArray(draft) ? undefined : draft;
      const unchanged = value !== undefined && (["core_id_list", "core_translations"].includes(field.kind) ? sameCoreReviewValue(value, valueOf(proposal, field)) : JSON.stringify(value) === JSON.stringify(valueOf(proposal, field)));
      return value === undefined || unchanged ? [] : [{ step_id: field.step_id, field_key: field.field_key, value }];
    });
    if (edits.length) await action.save(edits);
  });
  return <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
    {action.error && <Alert severity="error">{action.error}</Alert>}
    {readonly && <Alert severity="info">{t("proposal.readonly")}</Alert>}
    {!readonly && !metadata.confirmation.available && <Alert severity="info">{t(metadata.confirmation.reason === "nodia_ai:execution_unavailable" ? "proposal.executor_unavailable" : "proposal.confirmation_unavailable")}</Alert>}
    {action.uncertain && <Alert severity="warning" action={<Button disabled={busy} onClick={() => void action.recover()}>{t("proposal.recover")}</Button>}>{t(`proposal.uncertain_${action.uncertain}`)}</Alert>}
    {action.canReplay && <ReviewActions><Button disabled={busy} variant="outlined" onClick={() => void action.replay()}>{t("proposal.retry_confirmation")}</Button></ReviewActions>}
    {(proposal.execution_id || action.execution) && <ConfirmedExecution conversationId={conversationId} executionId={proposal.execution_id ?? action.execution!.execution_id} observed={observed} />}
    {proposal.state === "superseded" && <ReviewActions><Button disabled={busy} onClick={() => void action.recover()}>{t("proposal.show_current")}</Button></ReviewActions>}
    {editing && !readonly && <Box component="form" onSubmit={event => { event.preventDefault(); if (!busy && !action.uncertain) void save(); }} sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <Typography component="h5" variant="subtitle2">{t("proposal.edit_title")}</Typography>
      {proposal.steps.map((step, index) => {
        const stepFields = fields.filter(field => field.step_id === step.step_id);
        if (!stepFields.length) return null;
        return <Box component="fieldset" key={step.step_id} sx={{ m: 0, p: 0, border: 0, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        {proposal.steps.length > 1 && <Typography component="legend" variant="subtitle2">{t("proposal.edit_step", { position: index + 1 })}</Typography>}
        {stepFields.map(field => <Controller key={`${field.step_id}:${field.field_key}`} control={form.control} name={`values.${formKey(field)}`} render={({ field: input, fieldState }) => {
        const props = { label: label(field.label_key), disabled: busy, required: !field.nullable, error: Boolean(fieldState.error), helperText: fieldState.error ? t("proposal.invalid_field") : undefined };
        if (field.field_key === "value" && proposal.steps.find(step => step.step_id === field.step_id)?.tool_name.startsWith("nodia_preferences_prepare_")) return <PreferenceValueEditor proposal={proposal} stepId={field.step_id} value={typeof input.value === "string" ? input.value : ""} onChange={input.onChange} disabled={busy} label={props.label} error={props.error} observed={observed} />;
        if (field.kind === "core_id_list") return <CoreAssociationsEditor options={coreAssociationOptions(proposal.steps.find(step => step.step_id === field.step_id)?.changes.find(change => change.field_key === `${field.field_key}_details`)?.after)} label={props.label} disabled={busy} error={Boolean(fieldState.error)} maximum={field.maximum} value={Array.isArray(input.value) ? input.value.filter((value): value is string => typeof value === "string") : []} onChange={input.onChange} />;
        if (field.kind === "core_translations") return <CoreTranslationsEditor label={props.label} disabled={busy} error={Boolean(fieldState.error)} maximum={field.maximum} value={Array.isArray(input.value) ? input.value.filter((value): value is import("../../infrastructure/coreReview").CoreTranslationDraft => typeof value === "object" && "key" in value) : []} onChange={input.onChange} />;
        if (field.kind === "rental_cancellation_rules") return <CancellationRulesEditor label={props.label} disabled={busy} error={Boolean(fieldState.error)} value={Array.isArray(input.value) ? input.value.filter((value): value is import("../../infrastructure/cancellationRulesReview").NodiaAiCancellationRuleDraft => typeof value === "object" && "min_days_before" in value) : []} onChange={input.onChange} />;
        if (field.kind === "boolean" && field.nullable) return <SelectSingleInput {...props} clearable={false} value={input.value === null ? "unknown" : input.value === true ? "true" : "false"} options={[{ value: "unknown", label: t(field.field_key === "linen_ready" ? "proposal.rental_linen_values.unknown" : "proposal.null_value") }, { value: "true", label: t(field.field_key === "linen_ready" ? "proposal.rental_linen_values.true" : "proposal.true_value") }, { value: "false", label: t(field.field_key === "linen_ready" ? "proposal.rental_linen_values.false" : "proposal.false_value") }]} onChange={value => input.onChange(value === "unknown" ? null : value === "true")} />;
        if (field.kind === "boolean") return <SwitchWrapper><FormControlLabel label={label(field.label_key)} labelPlacement="start" sx={{ m: 0, width: "100%", justifyContent: "space-between", "& .MuiFormControlLabel-label": { fontWeight: 600 } }} control={<Switch checked={input.value === true} onChange={(_, checked) => input.onChange(checked)} disabled={busy} color="success" />} /></SwitchWrapper>;
        if (field.kind === "enum") return <SelectSingleInput {...props} options={field.options.map(option => ({ value: option.value, label: label(option.label_key) }))} value={typeof input.value === "string" ? input.value : null} onChange={input.onChange} clearable={field.nullable} />;
        const temporal = rentalTemporalKind(proposal, field);
        const temporalProps = { ...props, value: typeof input.value === "string" ? input.value : "", name: input.name, onChange: input.onChange, onBlur: input.onBlur };
        const timezone = temporal === "instant" ? rentalReviewTimezone(proposal, field) : null;
        return <Box sx={{ minWidth: 0 }}>
          {temporal === "date" ? <DateInput {...temporalProps} /> : temporal === "time" ? <TimeInput {...temporalProps} /> : temporal === "instant" ? timezone ? <DateTimeInput {...temporalProps} timezone={timezone} /> : <Alert severity="error">{t("proposal.rental_timezone_unavailable")}</Alert> : <TextInput {...temporalProps} multiline={["description", "notes", "resolution_note"].includes(field.field_key)} minRows={["description", "notes", "resolution_note"].includes(field.field_key) ? 3 : undefined} maxRows={["description", "notes", "resolution_note"].includes(field.field_key) ? 6 : undefined} />}
          {field.nullable && ["text", "integer", "bigint"].includes(field.kind) && <Box sx={{ mt: 1 }}>
            {input.value === null && <Typography variant="caption" component="p">{t("proposal.null_value")}</Typography>}
            <Button type="button" size="small" disabled={busy || input.value === null} sx={{ minHeight: 44, width: { xs: "100%", sm: "auto" } }} onClick={() => input.onChange(null)}>{t("proposal.set_null", { field: label(field.label_key) })}</Button>
          </Box>}
        </Box>;
      }} />)}
      </Box>;
      })}
      <ReviewActions><Button type="submit" variant="outlined" disabled={busy || Boolean(action.uncertain) || !form.formState.isDirty}>{t("proposal.save_revision")}</Button><Button disabled={busy || Boolean(action.uncertain)} onClick={() => setEditing(false)}>{t("proposal.close_editor")}</Button></ReviewActions>
    </Box>}
    {!readonly && <ReviewActions>
      {fields.length > 0 && !editing && <Button disabled={busy || Boolean(action.uncertain)} onClick={() => setEditing(true)}>{t("proposal.edit")}</Button>}
      <Button variant="contained" disabled={busy || editing || Boolean(action.uncertain) || action.requiresReview || !metadata.confirmation.available} onClick={() => void action.confirm()}>{t("proposal.confirm_exact", { revision: proposal.revision })}</Button>
    </ReviewActions>}
  </Box>;
}
