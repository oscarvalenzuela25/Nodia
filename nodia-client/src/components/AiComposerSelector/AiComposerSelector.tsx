import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Alert, Button, Typography } from "@mui/material";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import { useTranslation } from "react-i18next";
import type { NodiaAiConnection, NodiaAiMode, NodiaAiSelection } from "../../modules/nodiaAi/infrastructure/types";
import { catalogModelOptions, chooseModelEffort, modelOptionComplete, modelOptionEfforts, modelOptionFor } from "../../utils/modelVariantOptions";
import ComposerSelectionPopover, { type ComposerSelectionField } from "./ComposerSelectionPopover";
import { DraftActions, SelectionActionAlert } from "./styles";
import type { AiComposerSelectorProps } from "./types";

const sameSelection = (left: NodiaAiSelection | null, right: NodiaAiSelection | null) =>
  left !== null && right !== null && left.connection_id === right.connection_id
  && left.mode === right.mode && left.model_id === right.model_id && left.effort_id === right.effort_id;

const selectionKey = (selection: NodiaAiSelection | null) => JSON.stringify(selection && [
  selection.connection_id, selection.mode, selection.model_id, selection.effort_id,
]);

function SelectionEditor<Connection extends NodiaAiConnection>({
  connections, selection, onSelectionChange, onDirtyChange,
  eligibility, eligibilityBusy, eligibilityError, onRetryEligibility,
  isLoading, isFetching, isSaving, readOnly, error, onRetry,
  hasMore, onLoadMore, onApply, summaryRef, labels, unavailableMode,
}: AiComposerSelectorProps<Connection> & { summaryRef: RefObject<HTMLButtonElement | null> }) {
  const { t } = useTranslation("nodiaAi");
  const [connectionId, setConnectionId] = useState(selection?.connection_id ?? null);
  const [mode, setMode] = useState<NodiaAiMode | null>(selection?.mode ?? null);
  const [modelId, setModelId] = useState(selection?.model_id ?? null);
  const [effortId, setEffortId] = useState(selection?.effort_id ?? null);
  const [applying, setApplying] = useState(false);
  const submission = useRef(false);
  const connection = connections.find(item => item.connection_id === connectionId);
  const modeConfig = connection?.modes.find(item => item.mode === mode);
  const model = modeConfig?.models.find(item => item.model_id === modelId);
  const draft = useMemo<NodiaAiSelection | null>(() => connectionId && mode && modelId
    ? { connection_id: connectionId, mode, model_id: modelId, effort_id: effortId }
    : null, [connectionId, mode, modelId, effortId]);
  const catalogOptions = catalogModelOptions(modeConfig?.models ?? [], connection?.provider_key === "gemini" && mode === "agentic",
    { model_id: modelId ?? "", effort_id: effortId });
  const modelOption = modelOptionFor(catalogOptions, modelId ?? "");
  const reportedEfforts = modelOptionEfforts(modelOption);
  const dirty = connectionId !== (selection?.connection_id ?? null)
    || mode !== (selection?.mode ?? null) || modelId !== (selection?.model_id ?? null)
    || effortId !== (selection?.effort_id ?? null);
  useEffect(() => { onSelectionChange(draft); }, [draft, onSelectionChange]);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);

  const busy = isLoading || isFetching || isSaving || applying || eligibilityBusy;
  const disabled = busy || readOnly;
  const missing = connectionId !== null && (!connection || (mode !== null && !modeConfig)
    || (modelId !== null && !model) || (effortId !== null && !model?.efforts.some(item => item.effort_id === effortId)));
  const configurationDisabled = !!connection && (!connection.is_active || modeConfig?.configuration === "disabled");
  const modeBlock = connection && mode ? unavailableMode?.(connection, mode) : null;
  const exactEligibility = sameSelection(eligibility?.selection ?? null, draft) ? eligibility : null;
  const canApply = dirty && !disabled && !error && !eligibilityError && !missing && !modeBlock
    && !configurationDisabled && draft !== null && modelOptionComplete(modelOption, draft) && exactEligibility?.available === true;
  const connectionOptions = connections.map(item => ({ value: item.connection_id, label: item.label }));
  if (connectionId && !connection) connectionOptions.push({ value: connectionId, label: t("configuration.missing_connection", { id: connectionId }) });
  const modeOptions = connection?.modes.map(item => {
    const block = unavailableMode?.(connection, item.mode);
    const label = t(`modes.${item.mode}`);
    return { value: item.mode, label: block ? `${label} · ${block.label}` : label };
  }) ?? [];
  if (mode && !modeConfig) modeOptions.push({ value: mode, label: t(`modes.${mode}`) });
  const modelOptions = catalogOptions.map(item => ({ value: item.value, label: item.label }));
  if (modelId && !model) modelOptions.push({ value: modelId, label: t("configuration.missing_model", { id: modelId }) });
  const effortLabel = (id: string, label: string) => ["low", "medium", "high"].includes(id) ? t(`effort_levels.${id}`) : label;
  const effortOptions = reportedEfforts.map(item => ({ value: item.effort_id, label: effortLabel(item.effort_id, item.label) }));
  if (effortId && !model?.efforts.some(item => item.effort_id === effortId)) effortOptions.push({ value: effortId, label: t("configuration.missing_effort", { id: effortId }) });

  const appliedConnection = connections.find(item => item.connection_id === selection?.connection_id);
  const appliedMode = appliedConnection?.modes.find(item => item.mode === selection?.mode);
  const appliedModel = appliedMode?.models.find(item => item.model_id === selection?.model_id);
  const appliedEffort = appliedModel?.efforts.find(item => item.effort_id === selection?.effort_id);
  const appliedModelLabel = appliedModel?.label ?? selection?.model_id ?? t("configuration.unassigned_model");
  const appliedDetails = selection ? [
    appliedConnection?.label ?? t("configuration.missing_connection", { id: selection.connection_id }),
    t(`modes.${selection.mode}`),
    ...(selection.effort_id === null ? [] : [effortLabel(selection.effort_id, appliedEffort?.label ?? selection.effort_id)]),
  ].join(" · ") : labels.choose;
  const appliedIdentity = selection ? [selection.connection_id, selection.mode, selection.model_id, selection.effort_id]
    .filter(value => value !== null).join(" · ") : undefined;

  const apply = async () => {
    if (!canApply || !draft || submission.current) return;
    submission.current = true;
    setApplying(true);
    try {
      await onApply(draft);
    } catch {
      // The owner reports the error. Keep the picker open with the same draft.
    } finally {
      submission.current = false;
      setApplying(false);
    }
  };

  const fields: ComposerSelectionField[] = [{
    field: "connection", label: t("configuration.connection"), options: connectionOptions,
    value: connectionId, clearable: false, disabled, placeholder: t("configuration.unassigned_connection"),
    hasMore, onLoadMore, loadingOptions: isLoading || isFetching,
    onChange: value => {
      if (value === connectionId) return;
      const next = connections.find(item => item.connection_id === value);
      const preferredMode = next?.modes.find(item => item.mode === next.default_mode);
      const configured = preferredMode?.configured_selection;
      const exactConfigured = configured?.connection_id === value && configured?.mode === preferredMode?.mode ? configured : null;
      setConnectionId(value);
      setMode(preferredMode?.mode ?? null);
      setModelId(exactConfigured?.model_id ?? null);
      setEffortId(exactConfigured?.effort_id ?? null);
    },
  }];
  if (connectionId) fields.push({
    field: "mode", label: t("configuration.mode"), options: modeOptions, value: mode,
    clearable: false, disabled: disabled || !connection, placeholder: t("configuration.unassigned_mode"),
    onChange: value => {
      const next = connection?.modes.find(item => item.mode === value);
      if (!next || next.mode === mode) return;
      const configured = next.configured_selection;
      const exactConfigured = configured?.connection_id === connectionId && configured?.mode === next.mode ? configured : null;
      setMode(next.mode);
      setModelId(exactConfigured?.model_id ?? null);
      setEffortId(exactConfigured?.effort_id ?? null);
    },
  });
  if (mode) fields.push({
    field: "model", label: t("configuration.model"), options: modelOptions, value: modelOption?.value ?? modelId,
    clearable: false, disabled: disabled || !modeConfig || !!modeBlock, placeholder: t("configuration.unassigned_model"),
    onChange: value => {
      if (value === modelId || value === modelOption?.value) return;
      const configured = modeConfig?.configured_selection;
      const next = modelOptionFor(catalogOptions, value ?? "");
      const restore = configured?.connection_id === connectionId && configured.mode === mode && next
        && modelOptionFor(catalogOptions, configured.model_id) === next && modelOptionComplete(next, configured);
      setModelId(restore ? configured.model_id : value);
      setEffortId(restore ? configured.effort_id : null);
    },
  });
  if (modelId) fields.push({
    field: "effort", label: t("configuration.effort"), options: effortOptions, value: effortId,
    disabled: disabled || !model || effortOptions.length === 0 || !!modeBlock, placeholder: t("composer.unassigned_effort"),
    onChange: value => {
      if (!draft) return;
      const next = chooseModelEffort(modelOption, draft, value);
      setModelId(next.model_id);
      setEffortId(next.effort_id);
    },
  });
  const noConnections = !isLoading && !error && connections.length === 0;
  const unavailable = dirty && draft && !eligibilityBusy && !eligibilityError && exactEligibility?.available === false
    && !missing && !configurationDisabled && !modeBlock;
  const notices = <>
    {dirty && <Typography role="status" variant="caption" color="text.primary" sx={{ px: 1, overflowWrap: "anywhere" }}>
      {labels.unsaved}
    </Typography>}
    {error && <SelectionActionAlert severity="error" action={<Button type="button" color="inherit" disabled={busy} onClick={onRetry}>{t("retry")}</Button>}>{error}</SelectionActionAlert>}
    {noConnections && <Alert severity="info">{labels.noConnections}</Alert>}
    {missing && <Alert severity="warning">{labels.selectionMissing}</Alert>}
    {modeBlock ? <Alert severity="info">{modeBlock.message}</Alert>
      : configurationDisabled && <Alert severity="warning">{t("configuration.mode_disabled")}</Alert>}
    {dirty && eligibilityError && <SelectionActionAlert severity="error" action={<Button type="button" color="inherit" disabled={disabled} onClick={onRetryEligibility}>{t("retry")}</Button>}>{eligibilityError}</SelectionActionAlert>}
    {unavailable && <SelectionActionAlert severity="info" action={<Button type="button" color="inherit" disabled={disabled} onClick={onRetryEligibility}>{t("configuration.check_again")}</Button>}>
      {labels.unavailableReason(exactEligibility.reason)}
    </SelectionActionAlert>}
  </>;
  const actions = dirty && <DraftActions>
    <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
      {eligibilityBusy ? t("configuration.checking") : labels.scope}
    </Typography>
    <Button type="button" size="small" disabled={busy} onClick={() => {
      setConnectionId(selection?.connection_id ?? null);
      setMode(selection?.mode ?? null);
      setModelId(selection?.model_id ?? null);
      setEffortId(selection?.effort_id ?? null);
    }}>{t("configuration.cancel")}</Button>
    <Button type="button" size="small" variant="contained" startIcon={<CheckOutlined />}
      disabled={!canApply} loading={isSaving || applying} onClick={() => void apply()}>{t("configuration.apply")}</Button>
  </DraftActions>;
  return <ComposerSelectionPopover summaryRef={summaryRef} title={labels.title} triggerLabel={labels.trigger}
    closeLabel={t("close")} appliedLabel={t("configuration.selection_panel.applied")} appliedModel={appliedModelLabel}
    appliedMode={selection ? t(`modes.${selection.mode}`) : labels.choose} appliedDetails={appliedDetails}
    appliedIdentity={appliedIdentity} busy={busy} fields={fields} notices={notices}
    hasNotices={Boolean(dirty || error || missing || configurationDisabled || eligibilityError || modeBlock)}
    actions={actions} />;
}

export default function AiComposerSelector<Connection extends NodiaAiConnection>(props: AiComposerSelectorProps<Connection>) {
  const localSummary = useRef<HTMLButtonElement | null>(null);
  const summary = props.triggerRef ?? localSummary;
  const completedFocus = useRef<string | null>(null);
  const [confirmedFocus, setConfirmedFocus] = useState<string | null>(null);
  const key = selectionKey(props.selection);
  const summaryBusy = props.isLoading || props.isFetching || props.isSaving || props.eligibilityBusy;
  useEffect(() => {
    if (!summaryBusy && confirmedFocus === key && completedFocus.current !== confirmedFocus) {
      summary.current?.focus();
      completedFocus.current = confirmedFocus;
    }
  }, [confirmedFocus, key, summary, summaryBusy]);
  const apply = async (selection: NodiaAiSelection) => {
    completedFocus.current = null;
    setConfirmedFocus(null);
    await props.onApply(selection);
    // The owner can update the keyed editor before its promise resolves.
    setConfirmedFocus(selectionKey(selection));
  };
  return <SelectionEditor key={key} {...props} summaryRef={summary} onApply={apply} />;
}
