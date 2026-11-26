import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Alert, Button, Divider, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import useAuthStore from "../../../../store/authStore";
import { cvPdfErrorMessage, notifyCvPdfError } from "../../infrastructure/pdfFeedback";
import {
  fetchCvDraftPdf, prepareCvPdf, saveCvVersion, type CvPdfArtifact, type CvPdfTemplate, type CvVerifiedBytes,
} from "../../infrastructure/pdfVersions";
import { profileAccessDenied, profileWriteMayHaveCommitted, useProfileScope } from "../../infrastructure/profiles";
import { cvHttpStatus } from "../../infrastructure/useCvGenerationWorkflow";
import CvPdfReview from "../CvPdfReview";
import { cvPrimaryHover } from "../CvGeneration/styles";

const action = { minHeight: 44, width: { xs: "100%", sm: "auto" } };
type ArtifactState = { artifact: CvPdfArtifact; bytes: CvVerifiedBytes | null };
export type CvDraftPdfHandle = { saveForExit: () => Promise<boolean> };

type Props = {
  ref?: Ref<CvDraftPdfHandle>;
  generationId: string;
  revision: number;
  language: CvPdfArtifact["language"];
  initialTemplate?: CvPdfTemplate;
  active: boolean;
  disabled: boolean;
  onDenial: () => void;
  onRefresh: () => void;
  onOpenVersions: () => void;
  onSaved?: () => void;
  onSavingChange?: (saving: boolean) => void;
  onTemplateChange?: (template: CvPdfTemplate) => void;
};

export default function CvDraftPdf({
  ref, generationId, revision, language, initialTemplate = "classic", active, disabled,
  onDenial, onRefresh, onOpenVersions, onSaved, onSavingChange, onTemplateChange,
}: Props) {
  const { t } = useTranslation("nodiaCv");
  const { scope } = useProfileScope();
  const cache = useQueryClient();
  const [template, setTemplate] = useState(initialTemplate);
  const [result, setResult] = useState<ArtifactState | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [readError, setReadError] = useState<unknown>(null);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [saved, setSaved] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [ambiguousSave, setAmbiguousSave] = useState(false);
  const flight = useRef<AbortController | null>(null);
  const saveLock = useRef(false);
  const saveKeys = useRef(new Map<string, string>());
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => () => {
    flight.current?.abort();
    flight.current = null;
  }, [active, generationId, revision, template]);
  const expiresAt = result?.artifact.expires_at;
  useEffect(() => {
    if (!expiresAt) return;
    const expiration = Date.parse(expiresAt);
    const retire = () => {
      if (Date.now() < expiration) return;
      setResult(null);
    };
    const timer = window.setTimeout(retire, Math.max(0, expiration - Date.now() + 1));
    document.addEventListener("visibilitychange", retire);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", retire);
    };
  }, [expiresAt]);

  if (!active && (result || preparing)) {
    setResult(null);
    setPreparing(false);
  }
  const sameActor = () => {
    const state = useAuthStore.getState();
    return state.user?.id === scope[1] && state.sessionVersion === scope[2];
  };
  const currentView = () => mounted.current && sameActor();
  const clearedByHttp = (error: unknown) => [401, 403, 404, 410].includes(cvHttpStatus(error) ?? 0);
  const stale = [409, 410].includes(cvHttpStatus(readError) ?? 0) || [409, 410].includes(cvHttpStatus(saveError) ?? 0);
  const artifact = result?.artifact;
  const savedNumber = artifact ? saved.get(artifact.id) : undefined;
  const matchesCurrentDraft = (pdf: CvPdfArtifact) =>
    pdf.generation_id === generationId && pdf.revision === revision &&
    pdf.language === language && pdf.template === template && Date.parse(pdf.expires_at) > Date.now();

  const choose = (next: CvPdfTemplate | null) => {
    if (!next || template === next || disabled || flight.current || saveLock.current) return;
    setTemplate(next);
    onTemplateChange?.(next);
    setResult(null);
    setReadError(null);
    setSaveError(null);
    setAmbiguousSave(false);
  };
  const prepare = async (): Promise<ArtifactState | null> => {
    if (!active || disabled || !currentView() || flight.current || saveLock.current || stale) return null;
    const controller = new AbortController();
    flight.current = controller;
    setPreparing(true);
    setReadError(null);
    setSaveError(null);
    const current = () => currentView() && flight.current === controller && !controller.signal.aborted;
    const context = { version: scope[2], signal: controller.signal };
    try {
      const pdf = artifact && matchesCurrentDraft(artifact)
        ? artifact : await prepareCvPdf(generationId, { revision, template, language }, context);
      if (!current()) return null;
      setResult({ artifact: pdf, bytes: null });
      const bytes = await fetchCvDraftPdf(pdf, context);
      if (!current()) return null;
      if (!matchesCurrentDraft(pdf)) {
        setResult(null);
        onRefresh();
        return null;
      }
      const prepared = { artifact: pdf, bytes };
      setResult(prepared);
      sileo.success({ title: t("pdf_prepared") });
      return prepared;
    } catch (error) {
      if (current()) {
        if (clearedByHttp(error)) setResult(null);
        setReadError(error);
        notifyCvPdfError(error, onDenial);
      }
      return null;
    } finally {
      if (current()) {
        flight.current = null;
        setPreparing(false);
      }
    }
  };
  const save = async (prepared = result): Promise<boolean> => {
    const exact = prepared?.artifact;
    if (!active || disabled || !currentView() || !exact || prepared.bytes?.sha256 !== exact.sha256 ||
      !matchesCurrentDraft(exact) || stale || flight.current || saveLock.current) return false;
    if (saved.has(exact.id)) return true;
    const key = saveKeys.current.get(exact.id) ?? crypto.randomUUID();
    saveKeys.current.set(exact.id, key);
    saveLock.current = true;
    onSavingChange?.(true);
    setSaving(true);
    setSaveError(null);
    try {
      const version = await saveCvVersion(exact, key, { version: scope[2] });
      if (!sameActor()) return false;
      void cache.invalidateQueries({ queryKey: [...scope, "versions"] });
      sileo.success({ title: t("version_saved", { number: version.version_number }) });
      if (mounted.current) {
        setSaved((previous) => new Map(previous).set(exact.id, version.version_number));
        setAmbiguousSave(false);
        onSaved?.();
      }
      return true;
    } catch (error) {
      if (sameActor()) {
        if (mounted.current) {
          if (profileAccessDenied(error) || cvHttpStatus(error) === 410 || cvHttpStatus(error) === 404) setResult(null);
          setAmbiguousSave(profileWriteMayHaveCommitted(error));
          setSaveError(error);
        }
        notifyCvPdfError(error, onDenial);
      }
      return false;
    } finally {
      saveLock.current = false;
      if (sameActor()) {
        onSavingChange?.(false);
        if (mounted.current) setSaving(false);
      }
    }
  };

  const saveForExit = async () => {
    if (!active || disabled || !currentView() || stale || flight.current || saveLock.current) return false;
    const prepared = result?.bytes && matchesCurrentDraft(result.artifact) ? result : await prepare();
    return prepared ? save(prepared) : false;
  };
  useImperativeHandle(ref, () => ({ saveForExit }));

  if (!active) return null;
  return (
    <Stack spacing={1.75} sx={{ minWidth: 0 }}>
      <Divider />
      <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 750 }}>{t("pdf_panel_title")}</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1, alignItems: { sm: "center" }, flexWrap: "wrap" }}>
        <ToggleButtonGroup exclusive value={template} onChange={(_, next: CvPdfTemplate | null) => choose(next)}
          aria-label={t("pdf_template")} size="small" disabled={disabled || preparing || saving}
          sx={{ width: { xs: "100%", sm: "auto" }, "& button": { minHeight: 44, flex: { xs: 1, sm: "initial" } } }}>
          <ToggleButton value="classic">{t("pdf_templates.classic")}</ToggleButton>
          <ToggleButton value="compact">{t("pdf_templates.compact")}</ToggleButton>
        </ToggleButtonGroup>
        {!result?.bytes && (
          <Button variant="outlined" startIcon={<PictureAsPdfOutlined />} loading={preparing}
            disabled={disabled || stale || saving} onClick={() => void prepare()} sx={action}>
            {t(artifact && readError ? "pdf_retry_file" : "pdf_prepare")}
          </Button>
        )}
      </Stack>
      {readError !== null && <Alert severity="error">{cvPdfErrorMessage(readError)}</Alert>}
      {result && <CvPdfReview key={result.artifact.id} description={result.artifact} bytes={result.bytes}
        filename={`nodia-cv-${result.artifact.template}-${result.artifact.language}.pdf`} />}
      {saveError !== null && <Alert severity="error">{cvPdfErrorMessage(saveError)}</Alert>}
      {ambiguousSave && <Alert severity="warning">{t("version_save_uncertain")}</Alert>}
      {stale && <Button variant="outlined" disabled={disabled || saving} sx={action}
        onClick={() => { setResult(null); setReadError(null); setSaveError(null); onRefresh(); }}>
        {t("pdf_refresh_draft")}
      </Button>}
      {savedNumber !== undefined ? (
        <Stack spacing={1} sx={{ alignItems: { xs: "stretch", sm: "flex-start" } }}>
          <Typography variant="body2" role="status">{t("version_saved", { number: savedNumber })}</Typography>
          <Button variant="outlined" onClick={onOpenVersions} sx={action}>{t("versions_open_history")}</Button>
        </Stack>
      ) : (
        <Button variant="contained" startIcon={<SaveOutlined />} loading={saving}
          disabled={!result?.bytes || disabled || stale || preparing} onClick={() => void save()}
          sx={[{ ...action, alignSelf: { sm: "flex-start" } }, cvPrimaryHover]}>
          {t("version_save")}
        </Button>
      )}
    </Stack>
  );
}
