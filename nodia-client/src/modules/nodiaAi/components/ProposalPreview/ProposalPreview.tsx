import { isPreferenceTool, preferenceFieldLabels } from "../../infrastructure/preferencePresentation";
import { nodiaAiSecureKind } from "../../infrastructure/securePresentation";
import { nodiaAiProviderTool, nodiaAiProviderFieldLabels, nodiaAiProviderValueKey } from "../../infrastructure/aiProviderPresentation";
import { nodiaAiCoreTool, nodiaAiCoreFieldLabels } from "../../infrastructure/corePresentation";
import { nodiaAiBusinessTool, nodiaAiBusinessFieldLabels } from "../../infrastructure/businessPresentation";
import { nodiaAiRentalTool, nodiaAiRentalFieldLabels, nodiaAiRentalValueKey } from "../../infrastructure/rentalPresentation";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import FingerprintRounded from "@mui/icons-material/FingerprintRounded";
import { historicalSalesEffectKey, historicalSalesFieldKey, historicalSalesValueKey } from "../../infrastructure/historicalProposalPresentation";
import { Alert, Box, Button, Chip, LinearProgress, Typography } from "@mui/material";
import { Skeleton, type SkeletonProps } from "boneyard-js/react";
import { alpha, useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import useAuth from "../../../../hooks/useAuth";
import { useNodiaAiProposal, useNodiaAiProposalReview } from "../../infrastructure/useProposal";
import type { NodiaAiProposalRef, NodiaAiReviewValue } from "../../infrastructure/types";
import { Change, Fields, Preview, PreviewBody, Step, Summary, SummaryMeta, Dates, StepHeader, StepNumber, Context, ChangeField, ChangeValue, ChangeAbsence, ChangeArrow, TechnicalDetails, ReviewFooter } from "./styles";
import HumanProposalReview from "./HumanProposalReview";
import { nodiaAiFinanceTool, nodiaAiFinanceFieldLabels } from "../../infrastructure/financePresentation";

// Geometry only; first-load skeletons never contain simulated proposal data.
const proposalBones: SkeletonProps["initialBones"] = {
  name: "proposal-preview", viewportWidth: 600, width: 600, height: 184,
  bones: [[0, 8, 32, 24, 8], [0, 48, 80, 16, 4], [0, 88, 96, 72, 10]],
};

function ReviewValue({ value, scalarLabel, financial = false, business = false, rental = false, core = false, aiProvider = false, historicalSales = false, fieldKey }: { value: NodiaAiReviewValue; scalarLabel?: string; financial?: boolean; business?: boolean; rental?: boolean; core?: boolean; aiProvider?: boolean; historicalSales?: boolean; fieldKey?: string }) {
  const { t, i18n } = useTranslation("nodiaAi");
  const label = (key: string) => historicalSales && historicalSalesFieldKey(key) ? i18n.t(historicalSalesFieldKey(key)!) : aiProvider && Object.hasOwn(nodiaAiProviderFieldLabels, key) ? i18n.t(nodiaAiProviderFieldLabels[key]) : core && Object.hasOwn(nodiaAiCoreFieldLabels, key) ? i18n.t(nodiaAiCoreFieldLabels[key]) : financial && Object.hasOwn(nodiaAiFinanceFieldLabels, key) ? i18n.t(nodiaAiFinanceFieldLabels[key]) : business && Object.hasOwn(nodiaAiBusinessFieldLabels, key) ? i18n.t(nodiaAiBusinessFieldLabels[key]) : rental && Object.hasOwn(nodiaAiRentalFieldLabels, key) ? i18n.t(nodiaAiRentalFieldLabels[key]) : key.includes(":") && i18n.exists(key) ? i18n.t(key) : key;
  if (value === null) return <span>{t("proposal.null_value")}</span>;
  if (typeof value === "boolean") return <span>{t(value ? "proposal.true_value" : "proposal.false_value")}</span>;
  if (typeof value === "string") {
    const historicalValue = historicalSales ? historicalSalesValueKey(fieldKey, value) : undefined;
    const translatedEnum = financial && (fieldKey === "type" && ["income", "expense", "loan", "debt"].includes(value) || fieldKey === "status" && ["pending", "received", "paid", "cancelled"].includes(value)) ? i18n.t(`finance:${value}`) : undefined;
    const rentalValue = rental ? nodiaAiRentalValueKey(fieldKey, value) : undefined;
    const coreValue = core && fieldKey === "deletion_mode" && ["delete", "deactivate"].includes(value) ? t(`proposal.core_deletion_values.${value}`) : undefined;
    const providerValue = aiProvider ? nodiaAiProviderValueKey(fieldKey, value) : undefined;
    return <span style={{ whiteSpace: "pre-wrap" }}>{value === "" ? t("proposal.empty_string") : scalarLabel ?? (historicalValue ? i18n.t(historicalValue) : undefined) ?? (providerValue ? i18n.t(providerValue) : undefined) ?? translatedEnum ?? coreValue ?? (rentalValue ? i18n.t(rentalValue) : value)}</span>;
  }
  if (typeof value === "number") return <span>{String(value)}</span>;
  if (value.kind === "array") return value.items.length ? <Box component="ol" sx={{ m: 0, pl: 3 }}>
    {value.items.map((item, index) => <Box component="li" key={index} sx={{ minWidth: 0, mb: 1.5, "&:last-child": { mb: 0 } }}><ReviewValue value={item} historicalSales={historicalSales} financial={financial} business={business} rental={rental} core={core} aiProvider={aiProvider} /></Box>)}
  </Box> : <span>{t("proposal.empty_array")}</span>;
  return value.fields.length ? <Fields>{value.fields.map(field => <Box key={field.field_key}>
    <Typography component="dt" variant="caption" color="text.secondary">{label(field.field_key)}</Typography>
    <Box component="dd"><ReviewValue value={field.value} historicalSales={historicalSales} financial={financial} business={business} rental={rental} core={core} aiProvider={aiProvider} fieldKey={field.field_key} /></Box>
  </Box>)}</Fields> : <span>{t("proposal.empty_object")}</span>;
}

export default function ProposalPreview(props: { conversationId: string; proposalRef: NodiaAiProposalRef; visible?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const { user, sessionVersion } = useAuth();
  return <ProposalPreviewContent key={JSON.stringify([user?.id, sessionVersion, props.conversationId, props.proposalRef])} {...props} />;
}

function ProposalPreviewContent({ conversationId, proposalRef, visible = true, onBusyChange }: { conversationId: string; proposalRef: NodiaAiProposalRef; visible?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const { t, i18n } = useTranslation("nodiaAi");
  const theme = useTheme();
  const skeletonColor = alpha(theme.palette.text.primary, 0.1);
  const [currentRef, setCurrentRef] = useState(proposalRef);
  const [humanBusy, setHumanBusy] = useState(false);
  const query = useNodiaAiProposal(conversationId, currentRef, visible);
  const proposal = query.data;
  const review = useNodiaAiProposalReview(conversationId, currentRef, proposal, visible);
  const busy = query.isFetching || review.isFetching || humanBusy;
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  const label = (key: string) => key.includes(":") && i18n.exists(key) ? i18n.t(key) : key;
  const fieldLabel = (tool: string, key: string) => historicalSalesEffectKey(tool) && historicalSalesFieldKey(key) ? i18n.t(historicalSalesFieldKey(key)!) : isPreferenceTool(tool) && Object.hasOwn(preferenceFieldLabels, key) ? i18n.t(preferenceFieldLabels[key]) : (nodiaAiProviderTool(tool) || nodiaAiSecureKind(tool)) && Object.hasOwn(nodiaAiProviderFieldLabels, key) ? i18n.t(nodiaAiProviderFieldLabels[key]) : nodiaAiCoreTool(tool) && Object.hasOwn(nodiaAiCoreFieldLabels, key) ? i18n.t(nodiaAiCoreFieldLabels[key]) : nodiaAiFinanceTool(tool) && Object.hasOwn(nodiaAiFinanceFieldLabels, key) ? i18n.t(nodiaAiFinanceFieldLabels[key]) : nodiaAiBusinessTool(tool) && Object.hasOwn(nodiaAiBusinessFieldLabels, key) ? i18n.t(nodiaAiBusinessFieldLabels[key]) : nodiaAiRentalTool(tool) && Object.hasOwn(nodiaAiRentalFieldLabels, key) ? i18n.t(nodiaAiRentalFieldLabels[key]) : label(key);
  const scalarLabel = (tool: string, field: string, value: NodiaAiReviewValue): string | undefined => {
    if (typeof value !== "string") return undefined;
    const historicalValue = historicalSalesEffectKey(tool) ? historicalSalesValueKey(field, value) : undefined;
    if (historicalValue) return i18n.t(historicalValue);
    if (isPreferenceTool(tool) && field === "scope_key") return t(`preferences.scopes.${value}`);
    if (isPreferenceTool(tool) && field === "key") return t(`preferences.keys.${value}`);
    if (nodiaAiRentalTool(tool)) { const key = nodiaAiRentalValueKey(field, value); return key ? i18n.t(key) : undefined; }
    if (!nodiaAiFinanceTool(tool)) return undefined;
    if (field === "type" && ["income", "expense", "loan", "debt"].includes(value) || field === "status" && ["pending", "received", "paid", "cancelled"].includes(value))
      return i18n.t(`finance:${value}`);
    return undefined;
  };
  const date = (value: string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  const stepPosition = (id: string) => (proposal?.steps.findIndex(step => step.step_id === id) ?? -1) + 1;
  const stateColor = { draft: "default", ready: "info", confirmed: "success", superseded: "default", cancelled: "default", expired: "warning", invalidated: "error" } as const;
  return <Preview aria-label={t("proposal.preview")} aria-busy={busy}>
    {query.isFetching && !query.isLoading && <LinearProgress aria-label={t("proposal.refreshing")} />}
    {query.isError && <Alert severity="error" action={<Button variant="contained" disabled={query.isFetching} onClick={() => void query.refetch()}>{t("retry")}</Button>}>{t(query.accessRejected ? "proposal.restricted" : "proposal.load_error")}</Alert>}
    {review.isError && <Alert severity="error" action={<Button variant="contained" disabled={review.isFetching || query.isFetching} onClick={() => { if (!proposal) void query.refetch(); else void review.refetch(); }}>{t("retry")}</Button>}>{t("proposal.review_error")}</Alert>}
    <Skeleton loading={query.isLoading} initialBones={proposalBones} color={skeletonColor} darkColor={skeletonColor} animate={false}>
      {proposal && <PreviewBody>
        <Summary>
          <SummaryMeta>
            <Chip label={t(`proposal.states.${proposal.state}`)} size="small" color={stateColor[proposal.state]} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{t("proposal.revision", { revision: proposal.revision })}</Typography>
            <Typography variant="body2" color="text.secondary">{t("proposal.step_count", { count: proposal.steps.length })}</Typography>
            {proposal.steps.some(step => Boolean(historicalSalesEffectKey(step.tool_name))) && <Chip label={t("proposal.historical_sales_label")} size="small" variant="outlined" />}
          </SummaryMeta>
          {proposal.state !== "ready" && <Alert severity="warning">{t("proposal.historical")}</Alert>}
          <Dates>
            <div><dt>{t("proposal.created_label")}</dt><dd><time dateTime={proposal.created_at}>{date(proposal.created_at)}</time></dd></div>
            {proposal.expires_at !== null && <div><dt>{t("proposal.expires_label")}</dt><dd><time dateTime={proposal.expires_at}>{date(proposal.expires_at)}</time></dd></div>}
          </Dates>
        </Summary>
        {proposal.steps.map((step, index) => <Step key={step.step_id}>
          <StepHeader><StepNumber aria-hidden="true">{index + 1}</StepNumber><Box sx={{ minWidth: 0 }}>
          <Typography component="h5" variant="subtitle1" sx={{ fontWeight: 700 }}>{t("proposal.step", { position: index + 1, effect: isPreferenceTool(step.tool_name) ? t(`proposal.preference_effects.${step.tool_name}`) : nodiaAiSecureKind(step.tool_name) ? t(`secure.kinds.${nodiaAiSecureKind(step.tool_name)}`) : nodiaAiProviderTool(step.tool_name) ? t(`proposal.ai_provider_effects.${step.tool_name}`) : nodiaAiCoreTool(step.tool_name) ? t(`proposal.core_effects.${step.tool_name}`) : nodiaAiFinanceTool(step.tool_name) ? t(`proposal.financial_effects.${step.tool_name}`) : nodiaAiBusinessTool(step.tool_name) ? t(`proposal.business_effects.${step.tool_name}`) : nodiaAiRentalTool(step.tool_name) ? t(`proposal.rental_effects.${step.tool_name}`) : historicalSalesEffectKey(step.tool_name) ? i18n.t(historicalSalesEffectKey(step.tool_name)!) : label(step.effect_key) })}</Typography>
          <Typography variant="body2" color="text.secondary">{t(`proposal.kinds.${step.kind}`)}</Typography>
          </Box></StepHeader>
          {isPreferenceTool(step.tool_name) && <Alert severity="info">{t("preferences.description")}</Alert>}
          {nodiaAiFinanceTool(step.tool_name) && step.tool_name.endsWith("_delete") && <Alert severity="warning">{t(`proposal.financial_delete.${step.tool_name}`)}</Alert>}
          {nodiaAiSecureKind(step.tool_name) && <Alert severity="info">{t("secure.preview")}</Alert>}
          {nodiaAiRentalTool(step.tool_name) && ["nodia_rental_reservations_prepare_", "nodia_rental_payments_prepare_", "nodia_rental_expenses_prepare_"].some(prefix => step.tool_name.startsWith(prefix)) && <Typography variant="caption" component="p">{t("proposal.rental_amounts_unit")}</Typography>}
          {nodiaAiRentalTool(step.tool_name) && step.tool_name.startsWith("nodia_rental_payments_prepare_") && <Typography variant="body2">{t("proposal.rental_money_note")}</Typography>}
          {nodiaAiRentalTool(step.tool_name) && step.tool_name === "nodia_rental_expenses_prepare_pay" && <Typography variant="body2">{t("proposal.rental_expense_note")}</Typography>}
          {nodiaAiRentalTool(step.tool_name) && step.tool_name.startsWith("nodia_rental_turnovers_prepare_") && <Typography variant="body2">{t("proposal.rental_preparation_note")}</Typography>}
          {nodiaAiCoreTool(step.tool_name) && <Alert severity={step.tool_name.endsWith("_delete") ? "warning" : "info"}>{t(step.tool_name.endsWith("_delete") ? "proposal.core_delete_note" : "proposal.core_access_note")}</Alert>}
          {nodiaAiProviderTool(step.tool_name) && <Alert severity="info">{t("proposal.ai_provider_configuration_note")}</Alert>}
          {nodiaAiProviderTool(step.tool_name) && step.changes.some(change => change.field_key.endsWith(".thinking_level") && change.after === null) && <Typography variant="caption" component="p">{t("proposal.ai_provider_reasoning_note")}</Typography>}
          {(step.target !== null || Object.keys(step.scope).length > 0) && <Context>
          {step.target !== null && <Typography variant="body2">{t("proposal.target", { value: (nodiaAiCoreTool(step.tool_name) || nodiaAiProviderTool(step.tool_name) || nodiaAiSecureKind(step.tool_name)) && step.target.label ? `${step.target.label} · ${step.target.id}` : step.target.label ?? step.target.id })}</Typography>}
          {Object.entries(step.scope).map(([key, value]) => <Typography key={key} variant="body2">{t(`proposal.scope.${key}`, { value })}</Typography>)}
          </Context>}
          {step.precondition_summary && <Typography variant="body2">{t("proposal.preconditions", { value: step.precondition_summary })}</Typography>}
          {step.depends_on.length > 0 && <Typography variant="body2">{t("proposal.dependencies", { steps: step.depends_on.map(stepPosition).join(", ") })}</Typography>}
          {step.output_bindings.map(binding => <Typography key={`${binding.target_field_key}:${binding.from_step_id}:${binding.output_key}`} variant="body2">{t("proposal.binding", { field: fieldLabel(step.tool_name, binding.target_field_key), position: stepPosition(binding.from_step_id), output: binding.output_key === "id" ? t("proposal.output_id") : label(binding.output_key) })}</Typography>)}
          {!step.changes.length && <Typography variant="body2">{t("proposal.no_changes")}</Typography>}
          {step.changes.map(change => {
            const future = change.origin === "future_step" ? step.output_bindings.find(binding => binding.target_field_key === change.field_key) : undefined;
            return <ChangeField key={change.field_key}>
            <Typography component="h6" variant="body1" sx={{ fontWeight: 700 }}>{fieldLabel(step.tool_name, change.field_key)}</Typography>
            <Typography variant="caption" color="text.secondary">{t(`proposal.origins.${change.origin}`)}</Typography>
            <Change data-comparison={change.before_present && (change.after_present || Boolean(future))}>
              {change.before_present ? <ChangeValue data-side="before"><Typography variant="caption" component="p" color="text.secondary">{t("proposal.before")}</Typography><ReviewValue value={change.before} historicalSales={Boolean(historicalSalesEffectKey(step.tool_name))} financial={nodiaAiFinanceTool(step.tool_name)} business={nodiaAiBusinessTool(step.tool_name)} rental={nodiaAiRentalTool(step.tool_name)} core={nodiaAiCoreTool(step.tool_name)} aiProvider={nodiaAiProviderTool(step.tool_name) || !!nodiaAiSecureKind(step.tool_name)} fieldKey={change.field_key} scalarLabel={scalarLabel(step.tool_name, change.field_key, change.before)} /></ChangeValue> : <ChangeAbsence><span>{t("proposal.before")}:</span><span>{t("proposal.absent")}</span></ChangeAbsence>}
              {change.before_present && (change.after_present || Boolean(future)) && <ChangeArrow aria-hidden="true"><ArrowForwardRounded fontSize="small" /></ChangeArrow>}
              {change.after_present || future ? <ChangeValue data-side="after"><Typography variant="caption" component="p" color="primary.main">{t("proposal.after")}</Typography>{future ? <span>{t("proposal.future_reference", { position: stepPosition(future.from_step_id) })}</span> : change.after_present ? <ReviewValue value={change.after} historicalSales={Boolean(historicalSalesEffectKey(step.tool_name))} financial={nodiaAiFinanceTool(step.tool_name)} business={nodiaAiBusinessTool(step.tool_name)} rental={nodiaAiRentalTool(step.tool_name)} core={nodiaAiCoreTool(step.tool_name)} aiProvider={nodiaAiProviderTool(step.tool_name) || !!nodiaAiSecureKind(step.tool_name)} fieldKey={change.field_key} scalarLabel={scalarLabel(step.tool_name, change.field_key, change.after)} /> : <span>{t("proposal.absent")}</span>}</ChangeValue> : <ChangeAbsence><span>{t("proposal.after")}:</span><span>{t("proposal.absent")}</span></ChangeAbsence>}
            </Change>
          </ChangeField>;
          })}
        </Step>)}
        <TechnicalDetails>
          <summary><FingerprintRounded fontSize="small" />{t("proposal.technical_details")}</summary>
          <div>
            <Typography variant="caption" component="p">{t("proposal.proposal_id")} <code>{proposal.proposal_id}</code></Typography>
            <Typography variant="caption" component="p">{t("proposal.hash", { value: proposal.hash })}</Typography>
            <Typography variant="caption" component="p">{t("proposal.catalog_version")} <code>{proposal.catalog_version}</code></Typography>
          </div>
        </TechnicalDetails>
        {review.data && <ReviewFooter><HumanProposalReview key={`${proposal.proposal_id}:${proposal.revision}:${proposal.hash}`} conversationId={conversationId} proposal={proposal} metadata={review.data} onRevision={value => setCurrentRef({ proposal_id: value.proposal_id, revision: value.revision, hash: value.hash })} disabled={query.isFetching || review.isFetching || query.isError || review.isError} observed={visible} onBusyChange={setHumanBusy} /></ReviewFooter>}
      </PreviewBody>}
    </Skeleton>
  </Preview>;
}
