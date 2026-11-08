import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Alert, Button, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import UndoOutlined from "@mui/icons-material/UndoOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import { useTranslation } from "react-i18next";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import { connectionsSchema, eligibilitySchema, type Selection } from "../../infrastructure/schemas";
import { configuredSelection, defaultSelection, emptySelection, sameSelection, validSelection, type SelectionDraft } from "../../infrastructure/selection";
import { chooseModelEffort, modelOptionComplete, modelOptionEfforts, modelOptionFor, teacherModelOptions } from "../../infrastructure/modelOptions";
import { useTeacherQuery } from "../../infrastructure/useServices";
import { ComposerSelectionBar, Details, Fields, SelectionAccordion, Selector, Summary } from "./styles";

type Props = { initial: Selection | null; busy: boolean; presentation?: "panel" | "composer";
  onDirtyChange?: (dirty: boolean) => void; onReadyChange?: (ready: boolean) => void } & (
  { intent?: "session"; onSave: (selection: Selection) => Promise<void>; onSelectionChange?: never }
  | { intent: "create"; onSave?: never; onSelectionChange: (state: { selection: Selection | null; ready: boolean }) => void }
);
export default function SelectionPanel({ initial, busy, onSave, intent = "session", onSelectionChange, presentation = "panel", onDirtyChange, onReadyChange }: Props) {
  const { t, i18n } = useTranslation();
  const fieldsId = useId();
  const catalog = useTeacherQuery("connections", connectionsSchema);
  const [edited, setEdited] = useState<SelectionDraft | null>(null);
  const [opened, setOpened] = useState(false);
  const [applying, setApplying] = useState(false);
  const submission = useRef(false);
  const autoSaveAttempted = useRef(false);
  const preferred = defaultSelection(catalog.data);
  const draft = edited ?? initial ?? preferred ?? emptySelection;
  const catalogSelection = useMemo(() => validSelection(catalog.data, { connection_id: draft.connection_id, mode: draft.mode, model_id: draft.model_id, effort_id: draft.effort_id }), [catalog.data, draft.connection_id, draft.mode, draft.model_id, draft.effort_id]);
  const connection = catalog.data?.items.find(item => item.connection_id === draft.connection_id);
  const selectedMode = connection?.modes.find(item => item.mode === draft.mode);
  const model = selectedMode?.models.find(item => item.model_id === draft.model_id);
  const modelOptions = teacherModelOptions(selectedMode?.models ?? [], connection?.provider_key === "gemini" && draft.mode === "agentic", { ...draft });
  const modelOption = modelOptionFor(modelOptions, draft.model_id);
  const effortOptions = modelOptionEfforts(modelOption);
  const complete = modelOptionComplete(modelOption, { ...draft });
  const selection = complete ? catalogSelection : null;
  const eligibility = useTeacherQuery(`connections/${draft.connection_id}/eligibility`, eligibilitySchema, { mode: draft.mode, model_id: draft.model_id, ...(draft.effort_id ? { effort_id: draft.effort_id } : {}) }, Boolean(selection));
  const exactEligibility = sameSelection(eligibility.data?.selection, selection) ? eligibility.data : undefined;
  const disabled = busy || applying || catalog.isLoading || catalog.isFetching || eligibility.isFetching;
  const dirty = draft.connection_id !== (initial?.connection_id ?? "") || draft.mode !== (initial?.mode ?? null)
    || draft.model_id !== (initial?.model_id ?? "") || draft.effort_id !== (initial?.effort_id ?? null);
  const staleSelection = Boolean(draft.connection_id && !catalogSelection && !catalog.isLoading && !catalog.isError);
  const ready = Boolean(selection && exactEligibility?.eligible && !catalog.isFetching && !eligibility.isFetching && !catalog.isError && !eligibility.isError);
  const needsAttention = intent === "create" ? !ready : !initial || dirty || staleSelection || catalog.isError || eligibility.isError || exactEligibility?.eligible === false;
  const expanded = needsAttention || opened;
  const canSave = !disabled && dirty && ready;

  useEffect(() => {
    // One attempt, through the owner's CAS/idempotency/recovery path. Never replay after failure.
    if (intent === "create" || !onSave || initial || edited || busy || catalog.isFetching || catalog.isError || eligibility.isFetching || eligibility.isError
      || !selection || !exactEligibility?.eligible || autoSaveAttempted.current) return;
    autoSaveAttempted.current = true;
    setEdited(selection);
    submission.current = true;
    setApplying(true);
    void onSave(selection).catch(() => { /* The owner reports the failed write; never replay it automatically. */ })
      .finally(() => { submission.current = false; setApplying(false); });
  }, [initial, edited, busy, catalog.isFetching, catalog.isError, eligibility.isFetching, eligibility.isError, selection, exactEligibility, onSave, intent]);
  useEffect(() => { onSelectionChange?.({ selection, ready }); }, [onSelectionChange, selection, ready]);
  useEffect(() => { onDirtyChange?.(dirty || applying); }, [dirty, applying, onDirtyChange]);
  useEffect(() => { onReadyChange?.(ready && !applying && (intent === "create" || !dirty)); }, [ready, applying, dirty, intent, onReadyChange]);

  const save = async () => {
    if (!canSave || !selection || !onSave || submission.current) return;
    submission.current = true;
    setApplying(true);
    try { await onSave(selection); setOpened(false); }
    catch { /* The owner reports the failed write; preserve the complete selection draft. */ }
    finally { submission.current = false; setApplying(false); }
  };
  const reason = exactEligibility?.reason_code
    ? t(i18n.exists(`teacher:reasons.${exactEligibility.reason_code}`) ? `teacher:reasons.${exactEligibility.reason_code}` : "teacher:reasons.unknown") : null;
  const status = t(exactEligibility ? exactEligibility.eligible ? "teacher:selection_qualified" : "teacher:selection_unqualified" : "teacher:checking_selection");
  const feedback = <>
    <QueryErrorAlert retryVariant="outlined" isError={catalog.isError || eligibility.isError} isFetching={catalog.isFetching || eligibility.isFetching} onRetry={() => { void catalog.refetch(); if (selection) void eligibility.refetch(); }} />
    {staleSelection && <Alert severity="warning">{t("teacher:selection_missing")}</Alert>}
    {!catalog.isLoading && !catalog.isError && !catalog.data?.items.length && <Alert severity="info">{t("teacher:no_connections")}</Alert>}
    {exactEligibility?.eligible === false && <Alert severity="warning">{status}{reason ? ` · ${reason}` : ""}</Alert>}
  </>;
  const controls = <>
    <Selector compact={presentation === "composer"}><SelectSingleInput label={t("teacher:connection")} value={draft.connection_id || null} clearable={presentation !== "composer"} options={catalog.data?.items.map(item => ({ value: item.connection_id, label: item.label })) ?? []} onChange={value => { if (value !== draft.connection_id) setEdited(configuredSelection(catalog.data?.items.find(item => item.connection_id === value))); }} disabled={disabled} /></Selector>
    <Selector compact={presentation === "composer"}><SelectSingleInput label={t("teacher:mode")} value={draft.mode} clearable={presentation !== "composer"} options={connection?.modes.map(item => ({ value: item.mode, label: item.mode === "api_key" ? "API key" : "Agentic" })) ?? []} onChange={value => { if (value !== draft.mode) setEdited(configuredSelection(connection, value === "api_key" || value === "agentic" ? value : null)); }} disabled={disabled || !connection} /></Selector>
    <Selector compact={presentation === "composer"}><SelectSingleInput label={t("teacher:model")} value={modelOption?.value ?? (draft.model_id || null)} clearable={presentation !== "composer"} placeholder={t("teacher:no_model")} options={modelOptions.map(item => ({ value: item.value, label: item.label }))} onChange={value => { if (value === modelOption?.value || value === draft.model_id) return; const saved = selectedMode?.configured_selection; const next = modelOptionFor(modelOptions, value ?? ""); const savedOption = saved ? modelOptionFor(modelOptions, saved.model_id) : undefined; const restore = saved && saved.connection_id === draft.connection_id && saved.mode === draft.mode && next && savedOption === next && modelOptionComplete(next, saved); setEdited({ ...draft, model_id: restore ? saved.model_id : value ?? "", effort_id: restore ? saved.effort_id : null }); }} disabled={disabled || !selectedMode} /></Selector>
    <Selector compact={presentation === "composer"}><SelectSingleInput label={t("teacher:effort")} value={draft.effort_id} options={effortOptions.map(item => ({ value: item.effort_id, label: item.label }))} onChange={value => setEdited(chooseModelEffort(modelOption, { ...draft }, value))} disabled={disabled || !effortOptions.length} /></Selector>
  </>;

  if (presentation === "composer") return <ComposerSelectionBar aria-label={t("teacher:ai_selection")}>
    {controls}
    <Tooltip title={`${t("teacher:configuration_notice")} ${status}${reason ? ` · ${reason}` : ""}`}><IconButton aria-label={t("teacher:ai_selection")} color={exactEligibility?.eligible ? "primary" : "default"}><InfoOutlined fontSize="small" /></IconButton></Tooltip>
    {intent !== "create" && dirty && <>
      <Tooltip title={t("core:cancel")}><span><IconButton aria-label={t("core:cancel")} disabled={disabled || !initial} onClick={() => setEdited(null)}><UndoOutlined fontSize="small" /></IconButton></span></Tooltip>
      <Tooltip title={t("teacher:save_selection")}><span><IconButton aria-label={t("teacher:save_selection")} color="primary" disabled={!canSave} loading={applying} onClick={() => void save()}><CheckOutlined fontSize="small" /></IconButton></span></Tooltip>
    </>}
    {feedback}
  </ComposerSelectionBar>;

  const summary = [connection?.label ?? draft.connection_id, draft.mode === "api_key" ? "API key" : draft.mode === "agentic" ? "Agentic" : null,
    modelOption?.label ?? model?.label ?? draft.model_id, draft.effort_id].filter(Boolean).join(" · ");
  return <SelectionAccordion expanded={expanded} onChange={(_, value) => setOpened(value)} disableGutters elevation={0}>
    <Summary expandIcon={<ExpandMoreOutlined />} aria-controls={fieldsId}>
      <Stack sx={{ minWidth: 0, gap: 0.5 }}><Typography variant="h6" component="span" sx={{ fontSize: 22, fontWeight: 700, textTransform: "uppercase" }}>{t("teacher:ai_selection")}</Typography>
        {summary && <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{summary}</Typography>}
        {!expanded && <Typography variant="caption" color="text.secondary">{t(exactEligibility?.eligible ? "teacher:selection_qualified" : "teacher:checking_selection")}</Typography>}
      </Stack>
    </Summary>
    <Details><Stack sx={{ gap: 2 }}>
      {feedback}
      <Fields>{controls}</Fields>
      {intent !== "create" && onSave && <Button variant="contained" disabled={!canSave} loading={applying} onClick={() => void save()}>{t("teacher:save_selection")}</Button>}
    </Stack></Details>
  </SelectionAccordion>;
}
