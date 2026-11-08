import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Alert, Box, Button, IconButton, LinearProgress, Typography } from "@mui/material";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import { useTranslation } from "react-i18next";
import { nodiaAiEligibilityReasonKey } from "../../infrastructure/eligibilityPresentation";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import type { NodiaAiMode, NodiaAiSelection } from "../../infrastructure/types";
import type { ConfigurationDrawerProps } from "./types";
import {
  DrawerForm,
  Fields,
  Footer,
  Header,
  SettingsDrawer,
} from "./styles";

const sameSelection = (left: NodiaAiSelection | null, right: NodiaAiSelection | null) =>
  left !== null && right !== null && left.connection_id === right.connection_id
  && left.mode === right.mode && left.model_id === right.model_id && left.effort_id === right.effort_id;

function ConfigurationForm(props: ConfigurationDrawerProps & {
  titleId: string;
  submitting: boolean;
  setSubmitting: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const {
    connections, selection, onClose, onSelectionChange,
    eligibility, eligibilityBusy, eligibilityError, onRetryEligibility,
    isLoading, isFetching, isSaving, readOnly, error, onRetry,
    hasMore, onLoadMore, onApply, canManageConnection, titleId, submitting, setSubmitting,
  } = props;
  const [connectionId, setConnectionId] = useState<string | null>(selection?.connection_id ?? null);
  const [mode, setMode] = useState<NodiaAiMode | null>(selection?.mode ?? null);
  const [modelId, setModelId] = useState<string | null>(selection?.model_id ?? null);
  const [effortId, setEffortId] = useState<string | null>(selection?.effort_id ?? null);
  const submission = useRef(false);
  const connection = connections.find(item => item.connection_id === connectionId);
  const modeConfig = connection?.modes.find(item => item.mode === mode);
  const model = modeConfig?.models.find(item => item.model_id === modelId);
  const draftSelection = useMemo<NodiaAiSelection | null>(() =>
    connectionId && mode && modelId
      ? { connection_id: connectionId, mode, model_id: modelId, effort_id: effortId }
      : null, [connectionId, mode, modelId, effortId]);

  useEffect(() => {
    onSelectionChange(draftSelection);
  }, [draftSelection, onSelectionChange]);

  const controlsBusy = isLoading || isFetching || isSaving || submitting || eligibilityBusy;
  const fieldsDisabled = controlsBusy || readOnly;
  const exactEligibility = sameSelection(eligibility?.selection ?? null, draftSelection) ? eligibility : null;
  const supportsTools = exactEligibility?.supports_tools ?? exactEligibility?.supports_mcp;
  const configurationDisabled = !!connection && (!connection.is_active || modeConfig?.configuration === "disabled");
  const codex = connection?.provider_key === "openai" && mode === "agentic";
  const selectionMissing = connectionId !== null && (!connection || (mode !== null && !modeConfig)
    || (modelId !== null && !model) || (effortId !== null && !model?.efforts.some(item => item.effort_id === effortId)));
  const canApply = !fieldsDisabled && !eligibilityBusy && !error && !eligibilityError
    && !selectionMissing && draftSelection !== null && exactEligibility?.available === true
    && connection?.is_active === true && modeConfig?.configuration !== "disabled";
  const availableLabelKey = mode === "api_key" ? "nodiaAi:configuration.api_available" : "nodiaAi:configuration.available";

  const modeLabel = (value: NodiaAiMode) => t(`nodiaAi:modes.${value}`);
  const effortLabel = (value: string, label: string) => ["low", "medium", "high"].includes(value)
    ? t(`nodiaAi:effort_levels.${value}`) : label;
  const connectionOptions = connections.map(item => ({ value: item.connection_id, label: item.label }));
  if (connectionId && !connection) connectionOptions.push({ value: connectionId, label: t("nodiaAi:configuration.missing_connection", { id: connectionId }) });
  const modeOptions = (connection?.modes ?? [])
    .map(item => ({ value: item.mode, label: modeLabel(item.mode) }));
  if (mode && !modeConfig) modeOptions.push({ value: mode, label: modeLabel(mode) });
  const modelOptions = (modeConfig?.models ?? []).map(item => ({ value: item.model_id, label: item.label }));
  if (modelId && !model) modelOptions.push({ value: modelId, label: t("nodiaAi:configuration.missing_model", { id: modelId }) });
  const effortOptions = (model?.efforts ?? []).map(item => ({ value: item.effort_id, label: effortLabel(item.effort_id, item.label) }));
  if (effortId && !model?.efforts.some(item => item.effort_id === effortId)) effortOptions.push({ value: effortId, label: t("nodiaAi:configuration.missing_effort", { id: effortId }) });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canApply || !draftSelection || submission.current) return;
    submission.current = true;
    setSubmitting(true);
    try {
      await onApply({ selection: draftSelection, routingEnabled: false });
    } catch {
      // The owner reports the HTTP error and keeps this draft mounted for correction.
    } finally {
      submission.current = false;
      setSubmitting(false);
    }
  };

  return (
    <DrawerForm onSubmit={event => { void handleSubmit(event); }}>
      <Header>
        <Box sx={{ minWidth: 0 }}>
          <Typography id={titleId} component="h2" variant="h6">{t("nodiaAi:configuration.title")}</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>{t("nodiaAi:configuration.description")}</Typography>
        </Box>
        <IconButton onClick={onClose} disabled={isSaving || submitting} aria-label={t("nodiaAi:configuration.close")}><CloseOutlinedIcon /></IconButton>
      </Header>
      {controlsBusy && <LinearProgress aria-label={t("nodiaAi:configuration.loading")} sx={{ height: 2 }} />}
      <Fields>
        {error && <Alert severity="error" action={<Button variant="contained" color="inherit" onClick={onRetry} disabled={controlsBusy}>{t("nodiaAi:configuration.retry")}</Button>}>{error}</Alert>}
        {!isLoading && !error && connections.length === 0 && <Alert severity="info">{t("nodiaAi:configuration.no_connections")}</Alert>}
        {readOnly && <Alert severity="info">{t("nodiaAi:configuration.read_only")}</Alert>}
        <SelectSingleInput label={t("nodiaAi:configuration.connection")} options={connectionOptions} value={connectionId} clearable={false}
          disabled={fieldsDisabled} placeholder={t("nodiaAi:configuration.unassigned_connection")}
          hasMore={hasMore} onLoadMore={onLoadMore} loadingOptions={isLoading || isFetching}
          onChange={value => {
            if (value === connectionId) return;
            setConnectionId(value); setMode(null); setModelId(null); setEffortId(null);
          }} />
        <SelectSingleInput label={t("nodiaAi:configuration.mode")} options={modeOptions} value={mode} clearable={false}
          disabled={fieldsDisabled || !connection} placeholder={t("nodiaAi:configuration.unassigned_mode")}
          onChange={value => {
            const chosen = connection?.modes.find(item => item.mode === value);
            if (!chosen || chosen.mode === mode) return;
            setMode(chosen.mode);
            setModelId(chosen.configured_selection?.model_id ?? null);
            setEffortId(chosen.configured_selection?.effort_id ?? null);
          }} />
        <SelectSingleInput label={t("nodiaAi:configuration.model")} options={modelOptions} value={modelId} clearable={false}
          disabled={fieldsDisabled || !modeConfig} placeholder={t("nodiaAi:configuration.unassigned_model")}
          onChange={value => { if (value !== modelId) { setModelId(value); setEffortId(null); } }} />
        <SelectSingleInput label={t("nodiaAi:configuration.effort")} options={effortOptions} value={effortId}
          disabled={fieldsDisabled || !model || model.efforts.length === 0} placeholder={t("nodiaAi:configuration.unassigned_effort")}
          onChange={setEffortId} />
        <Typography variant="caption" color="text.secondary">{t("nodiaAi:configuration.effort_preference")}</Typography>
        {configurationDisabled && <Alert severity="warning">{t("nodiaAi:configuration.mode_disabled")}</Alert>}
        {selectionMissing && <Alert severity="warning">{t("nodiaAi:configuration.selection_missing")}</Alert>}
        {codex && <Box>
          <Typography variant="body2" color="text.secondary">{t("nodiaAi:configuration.codex_description")}</Typography>
          {canManageConnection && <Button variant="contained" component="a"
            href={`/ai-providers?provider=${encodeURIComponent(connectionId!)}&mode=agentic`}
            target="_blank" rel="noopener noreferrer" disabled={fieldsDisabled}
            sx={{ mt: 1, minHeight: 44, width: { xs: "100%", sm: "auto" } }}>
            {t("nodiaAi:configuration.codex_manage")}
          </Button>}
          <Typography variant="caption" component="p" color="text.secondary" sx={{ mt: 1, mb: 0 }}>{t("nodiaAi:configuration.codex_private_login")}</Typography>
        </Box>}
        {eligibilityError && <Alert severity="error" action={<Button variant="contained" color="inherit" disabled={controlsBusy || eligibilityBusy} onClick={onRetryEligibility}>{t("nodiaAi:configuration.retry")}</Button>}>{eligibilityError}</Alert>}
        {draftSelection && !configurationDisabled && !eligibilityError && <Alert severity={exactEligibility?.available ? "success" : "info"}>
          {t(eligibilityBusy ? "nodiaAi:configuration.checking" : exactEligibility?.available
            ? availableLabelKey : "nodiaAi:configuration.unavailable")}
          {!eligibilityBusy && exactEligibility?.available === false && <Typography variant="body2">
            {t(`nodiaAi:${nodiaAiEligibilityReasonKey(exactEligibility.reason)}`)}
          </Typography>}
          {exactEligibility?.available === false && !selectionMissing && <Button variant="contained" color="inherit"
            disabled={fieldsDisabled} onClick={onRetryEligibility}
            sx={{ display: "flex", mt: 1, minHeight: 44, width: { xs: "100%", sm: "auto" } }}>
            {t("nodiaAi:configuration.check_again")}
          </Button>}
        </Alert>}
        {!configurationDisabled && exactEligibility?.available === true && !eligibilityBusy && !eligibilityError && <Alert severity={supportsTools ? "success" : "info"}>
          {t(supportsTools ? "nodiaAi:configuration.tools_supported" : "nodiaAi:configuration.tools_unverified")}
        </Alert>}
        <Typography variant="caption" sx={{ color: "text.secondary" }}>{t("nodiaAi:configuration.scope")}</Typography>
      </Fields>
      <Footer>
        <Button variant="contained" onClick={onClose} disabled={isSaving || submitting}>{t("nodiaAi:configuration.cancel")}</Button>
        <Button type="submit" variant="contained" disabled={!canApply} loading={isSaving || submitting}>{t("nodiaAi:configuration.apply")}</Button>
      </Footer>
    </DrawerForm>
  );
}

export default function ConfigurationDrawer(props: ConfigurationDrawerProps) {
  const titleId = useId();
  const [submitting, setSubmitting] = useState(false);
  return (
    <SettingsDrawer anchor="right" open={props.open}
      onClose={() => { if (!props.isSaving && !submitting) props.onClose(); }}
      slotProps={{ paper: { role: "dialog", "aria-modal": true, "aria-labelledby": titleId } }}>
      {props.open && <ConfigurationForm {...props} titleId={titleId} submitting={submitting} setSubmitting={setSubmitting} />}
    </SettingsDrawer>
  );
}
