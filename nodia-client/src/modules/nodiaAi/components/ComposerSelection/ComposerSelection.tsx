import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Typography } from "@mui/material";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import { useTranslation } from "react-i18next";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import { nodiaAiEligibilityReasonKey } from "../../infrastructure/eligibilityPresentation";
import type { NodiaAiMode, NodiaAiSelection } from "../../infrastructure/types";
import { DraftActions, SelectionBar, Selector } from "./styles";
import type { ComposerSelectionProps } from "./types";

const sameSelection = (left: NodiaAiSelection | null, right: NodiaAiSelection | null) =>
  left !== null && right !== null && left.connection_id === right.connection_id
  && left.mode === right.mode && left.model_id === right.model_id && left.effort_id === right.effort_id;

function SelectionEditor({
  connections, selection, onSelectionChange, onDirtyChange,
  eligibility, eligibilityBusy, eligibilityError, onRetryEligibility,
  isLoading, isFetching, isSaving, readOnly, error, onRetry,
  hasMore, onLoadMore, onApply,
}: ComposerSelectionProps) {
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
    && !configurationDisabled && draft !== null && exactEligibility?.available === true;
  const connectionOptions = connections.map(item => ({ value: item.connection_id, label: item.label }));
  if (connectionId && !connection) connectionOptions.push({ value: connectionId, label: t("configuration.missing_connection", { id: connectionId }) });
  const modeOptions = (connection?.modes ?? []).map(item => ({ value: item.mode, label: t(`modes.${item.mode}`) }));
  if (mode && !modeConfig) modeOptions.push({ value: mode, label: t(`modes.${mode}`) });
  const modelOptions = (modeConfig?.models ?? []).map(item => ({ value: item.model_id, label: item.label }));
  if (modelId && !model) modelOptions.push({ value: modelId, label: t("configuration.missing_model", { id: modelId }) });
  const effortOptions = (model?.efforts ?? []).map(item => ({ value: item.effort_id,
    label: ["low", "medium", "high"].includes(item.effort_id) ? t(`effort_levels.${item.effort_id}`) : item.label }));
  if (effortId && !model?.efforts.some(item => item.effort_id === effortId)) effortOptions.push({ value: effortId, label: t("configuration.missing_effort", { id: effortId }) });

  const apply = async () => {
    if (!canApply || !draft || submission.current) return;
    submission.current = true;
    setApplying(true);
    try { await onApply({ selection: draft, routingEnabled: false }); }
    catch { /* The owner reports the HTTP error; the complete draft remains editable. */ }
    finally { submission.current = false; setApplying(false); }
  };

  return (
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
        <SelectSingleInput label={t("configuration.model")} options={modelOptions} value={modelId}
          clearable={false} disabled={disabled || !modeConfig} placeholder={t("configuration.unassigned_model")}
          onChange={value => {
            if (value === modelId) return;
            setModelId(value);
            const configured = modeConfig?.configured_selection;
            setEffortId(configured?.connection_id === connectionId && configured?.mode === mode && configured?.model_id === value
              ? configured.effort_id : null);
          }} />
      </Selector>}
      {modelId && <Selector>
        <SelectSingleInput label={t("configuration.effort")} options={effortOptions} value={effortId}
          disabled={disabled || !model || effortOptions.length === 0}
          placeholder={t("composer.unassigned_effort")} onChange={setEffortId} />
      </Selector>}
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
  );
}

export default function ComposerSelection(props: ComposerSelectionProps) {
  const selection = props.selection;
  // A server-confirmed selection starts a new editor; failed writes never change this key.
  const key = JSON.stringify(selection && [selection.connection_id, selection.mode, selection.model_id, selection.effort_id]);
  return <SelectionEditor key={key} {...props} />;
}
