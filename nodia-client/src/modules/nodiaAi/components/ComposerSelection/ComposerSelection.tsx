import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { Alert, Box, Button, IconButton, Typography } from "@mui/material";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import ExpandLessOutlined from "@mui/icons-material/ExpandLessOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { useTranslation } from "react-i18next";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import { catalogModelOptions, chooseModelEffort, modelOptionComplete, modelOptionEfforts, modelOptionFor } from "../../../../utils/modelVariantOptions";
import { nodiaAiEligibilityReasonKey } from "../../infrastructure/eligibilityPresentation";
import type { NodiaAiMode, NodiaAiSelection } from "../../infrastructure/types";
import { DraftActions, SelectionBar, SelectionPanel, SelectionPopover, SelectionSummary, Selector, SummaryContent } from "./styles";
import type { ComposerSelectionProps } from "./types";

const sameSelection = (left: NodiaAiSelection | null, right: NodiaAiSelection | null) =>
  left !== null && right !== null && left.connection_id === right.connection_id
  && left.mode === right.mode && left.model_id === right.model_id && left.effort_id === right.effort_id;

const selectionKey = (selection: NodiaAiSelection | null) => JSON.stringify(selection && [
  selection.connection_id, selection.mode, selection.model_id, selection.effort_id,
]);

function SelectionEditor({
  connections, selection, onSelectionChange, onDirtyChange,
  eligibility, eligibilityBusy, eligibilityError, onRetryEligibility,
  isLoading, isFetching, isSaving, readOnly, error, onRetry,
  hasMore, onLoadMore, onApply, summaryRef: summary,
}: ComposerSelectionProps & { summaryRef: RefObject<HTMLButtonElement | null> }) {
  const { t } = useTranslation("nodiaAi");
  const panelId = useId();
  const [opened, setOpened] = useState(false);
  const [visited, setVisited] = useState(false);
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
  const exactEligibility = sameSelection(eligibility?.selection ?? null, draft) ? eligibility : null;
  const canApply = dirty && !disabled && !error && !eligibilityError && !missing
    && !configurationDisabled && draft !== null && modelOptionComplete(modelOption, draft) && exactEligibility?.available === true;
  const connectionOptions = connections.map(item => ({ value: item.connection_id, label: item.label }));
  if (connectionId && !connection) connectionOptions.push({ value: connectionId, label: t("configuration.missing_connection", { id: connectionId }) });
  const modeOptions = (connection?.modes ?? []).map(item => ({ value: item.mode, label: t(`modes.${item.mode}`) }));
  if (mode && !modeConfig) modeOptions.push({ value: mode, label: t(`modes.${mode}`) });
  const modelOptions = catalogOptions.map(item => ({ value: item.value, label: item.label }));
  if (modelId && !model) modelOptions.push({ value: modelId, label: t("configuration.missing_model", { id: modelId }) });
  const effortOptions = reportedEfforts.map(item => ({ value: item.effort_id,
    label: ["low", "medium", "high"].includes(item.effort_id) ? t(`effort_levels.${item.effort_id}`) : item.label }));
  if (effortId && !model?.efforts.some(item => item.effort_id === effortId)) effortOptions.push({ value: effortId, label: t("configuration.missing_effort", { id: effortId }) });

  const appliedConnection = connections.find(item => item.connection_id === selection?.connection_id);
  const appliedMode = appliedConnection?.modes.find(item => item.mode === selection?.mode);
  const appliedModel = appliedMode?.models.find(item => item.model_id === selection?.model_id);
  const appliedEffort = appliedModel?.efforts.find(item => item.effort_id === selection?.effort_id);
  const appliedModelLabel = appliedModel?.label ?? selection?.model_id ?? t("configuration.unassigned_model");
  const appliedDetails = selection ? [
    appliedConnection?.label ?? t("configuration.missing_connection", { id: selection.connection_id }),
    t(`modes.${selection.mode}`),
    ...(selection.effort_id === null ? [] : [
      ["low", "medium", "high"].includes(selection.effort_id)
        ? t(`effort_levels.${selection.effort_id}`) : appliedEffort?.label ?? selection.effort_id,
    ]),
  ].join(" · ") : t("configuration.selection_panel.choose");
  const appliedIdentity = selection ? [selection.connection_id, selection.mode, selection.model_id, selection.effort_id]
    .filter(value => value !== null).join(" · ") : undefined;
  const closePanel = () => {
    if (busy) return;
    setOpened(false);
  };

  const apply = async () => {
    if (!canApply || !draft || submission.current) return;
    submission.current = true;
    setApplying(true);
    try { await onApply({ selection: draft, routingEnabled: false }); }
    catch { setOpened(true); /* The owner reports the HTTP error; retain the complete visible draft. */ }
    finally { submission.current = false; setApplying(false); }
  };

  const notices = <>
      {dirty && <Typography role="status" variant="caption" color="text.primary" sx={{ px: 1, overflowWrap: "anywhere" }}>
        {t("configuration.selection_panel.unsaved")}
      </Typography>}
      {error && <Alert severity="error" action={<Button type="button" color="inherit" disabled={busy} onClick={onRetry}>{t("retry")}</Button>}>{error}</Alert>}
      {!isLoading && !error && connections.length === 0 && <Alert severity="info">{t("configuration.no_connections")}</Alert>}
      {missing && <Alert severity="warning">{t("configuration.selection_missing")}</Alert>}
      {configurationDisabled && <Alert severity="warning">{t("configuration.mode_disabled")}</Alert>}
      {dirty && eligibilityError && <Alert severity="error" action={<Button type="button" color="inherit" disabled={disabled} onClick={onRetryEligibility}>{t("retry")}</Button>}>{eligibilityError}</Alert>}
      {dirty && draft && !eligibilityBusy && !eligibilityError && exactEligibility?.available === false && !missing && !configurationDisabled && (
        <Alert severity="info" action={<Button type="button" color="inherit" disabled={disabled} onClick={onRetryEligibility}>{t("configuration.check_again")}</Button>}>
          {t(nodiaAiEligibilityReasonKey(exactEligibility.reason))}
        </Alert>
      )}
  </>;

  return (
    <SelectionPanel>
      <SelectionSummary ref={summary} type="button" variant="text" disabled={busy}
        aria-label={t("configuration.selection_panel.title")} aria-expanded={opened} aria-controls={visited ? panelId : undefined} aria-haspopup="dialog"
        aria-describedby={`${panelId}-applied`}
        title={[appliedModelLabel, appliedDetails, appliedIdentity].filter(Boolean).join("\n")} endIcon={opened ? <ExpandLessOutlined /> : <ExpandMoreOutlined />}
        onClick={() => {
          if (opened) closePanel();
          else { setVisited(true); setOpened(true); }
        }}>
        <SummaryContent>
          <span id={`${panelId}-applied`} data-selection-description>{t("configuration.selection_panel.applied")}: {appliedModelLabel} · {appliedDetails}</span>
          <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>{appliedModelLabel}</Typography>
          <Typography component="span" variant="caption" color="text.secondary">{selection ? t(`modes.${selection.mode}`) : t("configuration.selection_panel.choose")}</Typography>
        </SummaryContent>
      </SelectionSummary>
      {!opened && notices}
      {visited && <SelectionPopover open={opened} anchorEl={() => summary.current} keepMounted
        anchorOrigin={{ vertical: "top", horizontal: "left" }} transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        marginThreshold={16} onClose={closePanel}
        slotProps={{ paper: { id: panelId, role: "dialog", "aria-modal": true, "aria-labelledby": `${panelId}-title` } }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
            <Typography component="h2" variant="subtitle2" id={`${panelId}-title`}>{t("configuration.title")}</Typography>
            <Typography variant="caption" color="text.secondary">{t("configuration.selection_panel.applied")}: {appliedModelLabel} · {appliedDetails}</Typography>
          </Box>
          <IconButton type="button" aria-label={t("close")} disabled={busy} onClick={closePanel} sx={{ width: 44, height: 44, flexShrink: 0 }}><CloseOutlined /></IconButton>
        </Box>
        {opened && <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: dirty || error || missing || configurationDisabled || eligibilityError ? 1 : 0 }}>{notices}</Box>}
        <SelectionBar aria-label={t("configuration.title")}>
      <Selector>
        <SelectSingleInput label={t("configuration.connection")} options={connectionOptions}
          value={connectionId} clearable={false} disabled={disabled}
          placeholder={t("configuration.unassigned_connection")} hasMore={hasMore}
          onLoadMore={onLoadMore} loadingOptions={isLoading || isFetching}
          onChange={value => {
            if (value === connectionId) return;
            const next = connections.find(item => item.connection_id === value);
            const preferredMode = next?.modes.find(item => item.mode === next.default_mode);
            const configured = preferredMode?.configured_selection;
            const exactConfigured = configured?.connection_id === value && configured?.mode === preferredMode?.mode
              ? configured : null;
            setConnectionId(value); setMode(preferredMode?.mode ?? null);
            setModelId(exactConfigured?.model_id ?? null); setEffortId(exactConfigured?.effort_id ?? null);
          }} />
      </Selector>
      {connectionId && <Selector>
        <SelectSingleInput label={t("configuration.mode")} options={modeOptions} value={mode}
          clearable={false} disabled={disabled || !connection} placeholder={t("configuration.unassigned_mode")}
          onChange={value => {
            const next = connection?.modes.find(item => item.mode === value);
            if (!next || next.mode === mode) return;
            const configured = next.configured_selection;
            const exactConfigured = configured?.connection_id === connectionId && configured?.mode === next.mode ? configured : null;
            setMode(next.mode); setModelId(exactConfigured?.model_id ?? null);
            setEffortId(exactConfigured?.effort_id ?? null);
          }} />
      </Selector>}
      {mode && <Selector>
        <SelectSingleInput label={t("configuration.model")} options={modelOptions} value={modelOption?.value ?? modelId}
          clearable={false} disabled={disabled || !modeConfig} placeholder={t("configuration.unassigned_model")}
          onChange={value => {
            if (value === modelId || value === modelOption?.value) return;
            const configured = modeConfig?.configured_selection;
            const next = modelOptionFor(catalogOptions, value ?? "");
            const restore = configured?.connection_id === connectionId && configured.mode === mode && next
              && modelOptionFor(catalogOptions, configured.model_id) === next && modelOptionComplete(next, configured);
            setModelId(restore ? configured.model_id : value);
            setEffortId(restore ? configured.effort_id : null);
          }} />
      </Selector>}
      {modelId && <Selector>
        <SelectSingleInput label={t("configuration.effort")} options={effortOptions} value={effortId}
          disabled={disabled || !model || effortOptions.length === 0}
          placeholder={t("composer.unassigned_effort")} onChange={value => {
            if (!draft) return;
            const next = chooseModelEffort(modelOption, draft, value);
            setModelId(next.model_id); setEffortId(next.effort_id);
          }} />
      </Selector>}
      {dirty && <DraftActions>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          {t(eligibilityBusy ? "configuration.checking" : "configuration.scope")}
        </Typography>
        <Button type="button" size="small" disabled={busy} onClick={() => {
          setConnectionId(selection?.connection_id ?? null); setMode(selection?.mode ?? null);
          setModelId(selection?.model_id ?? null); setEffortId(selection?.effort_id ?? null);
        }}>{t("configuration.cancel")}</Button>
        <Button type="button" size="small" variant="contained" startIcon={<CheckOutlined />}
          disabled={!canApply} loading={isSaving || applying} onClick={() => void apply()}>{t("configuration.apply")}</Button>
      </DraftActions>}
        </SelectionBar>
      </SelectionPopover>}
    </SelectionPanel>
  );
}

export default function ComposerSelection(props: ComposerSelectionProps) {
  const summary = useRef<HTMLButtonElement | null>(null);
  const completedFocus = useRef<string | null>(null);
  const [confirmedFocus, setConfirmedFocus] = useState<string | null>(null);
  // A server-confirmed selection starts a new editor; failed writes never change this key.
  const key = selectionKey(props.selection);
  const summaryBusy = props.isLoading || props.isFetching || props.isSaving || props.eligibilityBusy;
  useEffect(() => {
    if (!summaryBusy && confirmedFocus === key && completedFocus.current !== confirmedFocus) {
      summary.current?.focus();
      completedFocus.current = confirmedFocus;
    }
  }, [confirmedFocus, key, summaryBusy]);
  const apply: ComposerSelectionProps["onApply"] = async change => {
    completedFocus.current = null;
    setConfirmedFocus(null);
    await props.onApply(change);
    // A successful write may update the keyed editor before its promise resolves.
    // Focus only the new server-confirmed summary, never the detached old trigger.
    setConfirmedFocus(selectionKey(change.selection));
  };
  return <SelectionEditor key={key} {...props} summaryRef={summary} onApply={apply} />;
}
