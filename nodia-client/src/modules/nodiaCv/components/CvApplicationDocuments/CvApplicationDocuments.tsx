import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Button, Paper, Stack, Typography,
} from "@mui/material";
import AttachFileOutlined from "@mui/icons-material/AttachFileOutlined";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import ExpandMore from "@mui/icons-material/ExpandMore";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import TextInput from "../../../../components/inputs/TextInput";
import useAuthStore, { hasActiveSession } from "../../../../store/authStore";
import {
  applicationLetterDrafts, isApplicationDocumentText, isRecommendationPdf, renderCvApplicationDocument,
  type CvApplicationDocumentKind,
} from "../../infrastructure/applicationDocuments";
import { cvPdfErrorMessage, notifyCvPdfError } from "../../infrastructure/pdfFeedback";
import { useProfileScope } from "../../infrastructure/profiles";
import type { CvGenerationView } from "../../infrastructure/useCvGenerationWorkflow";
import { attachmentSummary, documentAction, documentPanel } from "./styles";

type Props = { view: CvGenerationView; onDenial?: () => void };

function DocumentPanel({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <Accordion disableGutters elevation={0} sx={documentPanel}>
      <AccordionSummary expandIcon={<ExpandMore />} id={id} aria-controls={`${id}-content`}>
        <Typography component="span" sx={{ fontWeight: 600 }}>{title}</Typography>
      </AccordionSummary>
      <AccordionDetails>{children}</AccordionDetails>
    </Accordion>
  );
}

function ApplicationDocumentsEditor({ view, owner, version, revision, onDenial }: Props & {
  owner: string | number; version: number; revision: number;
}) {
  const { t } = useTranslation("nodiaCv");
  const heading = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const attachmentRead = useRef(0);
  const downloads = useRef(new Map<string, number>());
  const [denied, setDenied] = useState(false);
  const [edits, setEdits] = useState<Partial<Record<CvApplicationDocumentKind, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<CvApplicationDocumentKind, string>>>({});
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState(false);
  const [readingAttachment, setReadingAttachment] = useState(false);
  const [validations, setValidations] = useState<Partial<Record<CvApplicationDocumentKind, boolean>>>({});
  const letters = useMemo(() => applicationLetterDrafts(view), [view]);
  const mutation = useMutation({
    mutationFn: ({ kind, text, signal }: { kind: CvApplicationDocumentKind; text: string; signal: AbortSignal }) =>
      renderCvApplicationDocument(view.receipt.id, { revision, kind, text }, { version, signal }),
    retry: false, gcTime: 0,
  });
  const busy = readingAttachment || mutation.isPending;

  useEffect(() => {
    const activeDownloads = downloads.current;
    return () => {
      attachmentRead.current += 1;
      for (const [url, timer] of activeDownloads) {
        window.clearTimeout(timer);
        URL.revokeObjectURL(url);
      }
      activeDownloads.clear();
    };
  }, []);
  useEffect(() => () => {
    requestRef.current?.abort();
  }, [revision]);

  const inSession = () => {
    const session = useAuthStore.getState();
    return session.sessionVersion === version && session.user?.id === owner && hasActiveSession(session);
  };

  const triggerDownload = (file: Blob, filename: string) => {
    const url = URL.createObjectURL(file);
    const timer = window.setTimeout(() => {
      URL.revokeObjectURL(url);
      downloads.current.delete(url);
    }, 30_000);
    downloads.current.set(url, timer);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    try { link.click(); } finally { link.remove(); }
  };

  const downloadDraft = async (kind: CvApplicationDocumentKind) => {
    if (busy || requestRef.current || !inSession()) return;
    const text = edits[kind] ?? letters[kind];
    setValidations((state) => ({ ...state, [kind]: true }));
    if (!isApplicationDocumentText(text)) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setErrors((state) => ({ ...state, [kind]: undefined }));
    try {
      const pdf = await mutation.mutateAsync({ kind, text, signal: controller.signal });
      if (!controller.signal.aborted && inSession()) {
        const filenames = view.receipt.language === "es" ? {
          cover: "carta-presentacion.pdf", recommendation: "borrador-carta-recomendacion.pdf",
        } : { cover: "cover-letter.pdf", recommendation: "recommendation-letter-draft.pdf" };
        triggerDownload(new Blob([pdf.buffer], { type: "application/pdf" }), filenames[kind]);
        sileo.success({ title: t("application_documents.pdf_ready") });
      }
    } catch (error) {
      if (controller.signal.aborted || !inSession()) return;
      notifyCvPdfError(error, () => {
        setDenied(true);
        onDenial?.();
      });
      setErrors((state) => ({ ...state, [kind]: cvPdfErrorMessage(error) }));
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        mutation.reset();
      }
    }
  };

  const readAttachment = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || busy || !inSession()) return;
    const operation = ++attachmentRead.current;
    setReadingAttachment(true);
    setAttachmentError(false);
    let valid = false;
    try { valid = await isRecommendationPdf(file); } catch { /* Keep the existing attachment if reading fails. */ }
    if (operation !== attachmentRead.current || !inSession()) return;
    setReadingAttachment(false);
    if (valid) {
      setAttachment(file);
      sileo.success({ title: t("application_documents.attached") });
    } else {
      setAttachmentError(true);
      sileo.error({ title: t("application_documents.invalid_attachment") });
    }
  };

  const downloadAttachment = () => {
    if (!attachment || busy || !inSession()) return;
    try {
      triggerDownload(attachment, attachment.name);
    } catch {
      sileo.error({ title: t("application_documents.download_error") });
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
    setAttachmentError(false);
    sileo.success({ title: t("application_documents.removed") });
  };

  const renderEditor = (kind: CvApplicationDocumentKind) => {
    const value = edits[kind] ?? letters[kind];
    const invalid = validations[kind] === true && !isApplicationDocumentText(value);
    return (
      <Stack spacing={1.5} sx={{ alignItems: { sm: "flex-start" } }}>
        <TextInput
          label={t(kind === "cover" ? "application_documents.cover_text" : "application_documents.recommendation_text")}
          value={value} onChange={(event) => {
            const text = event.currentTarget.value;
            setEdits((state) => ({ ...state, [kind]: text }));
            setErrors((state) => ({ ...state, [kind]: undefined }));
          }}
          onBlur={() => setValidations((state) => ({ ...state, [kind]: true }))}
          fullWidth multiline minRows={5} maxRows={12} required disabled={busy}
          error={invalid} helperText={invalid ? t("application_documents.invalid_text") : undefined}
        />
        {errors[kind] && <Alert severity="error" sx={{ width: "100%" }}>{errors[kind]}</Alert>}
        <Button variant="outlined" startIcon={<DownloadOutlined />} disabled={busy}
          loading={mutation.isPending && mutation.variables?.kind === kind} sx={documentAction}
          onClick={() => void downloadDraft(kind)}>
          {t(kind === "cover" ? "application_documents.download_cover" : "application_documents.download_recommendation")}
        </Button>
      </Stack>
    );
  };

  if (denied) return <Alert severity="error">{t("application_documents.access_denied")}</Alert>;
  return (
    <Paper component="section" aria-labelledby={heading} variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Typography id={heading} component="h2" variant="h6">{t("application_documents.title")}</Typography>
        <Typography variant="body2" color="text.secondary">{t("application_documents.temporary")}</Typography>
        <DocumentPanel title={t("application_documents.cover_title")}>{renderEditor("cover")}</DocumentPanel>
        <DocumentPanel title={t("application_documents.recommendation_title")}>
          <Stack spacing={2}>
            <Stack spacing={1} sx={{ alignItems: { sm: "flex-start" } }}>
              <input ref={inputRef} hidden type="file" accept=".pdf,application/pdf"
                aria-label={t("application_documents.attach")} onChange={(event) => void readAttachment(event)} />
              <Button variant="outlined" startIcon={<AttachFileOutlined />} disabled={busy}
                loading={readingAttachment} sx={documentAction}
                onClick={() => inputRef.current?.click()}>{t("application_documents.attach")}</Button>
              {attachmentError && <Alert severity="error">{t("application_documents.invalid_attachment")}</Alert>}
              {attachment && (
                <>
                  <Typography variant="body2" sx={attachmentSummary}>{attachment.name}</Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} sx={{ width: "100%", gap: 1, flexWrap: "wrap" }}>
                    <Button startIcon={<DownloadOutlined />} disabled={busy} sx={documentAction}
                      onClick={downloadAttachment}>{t("application_documents.download_attached")}</Button>
                    <Button disabled={busy} sx={documentAction}
                      onClick={removeAttachment}>{t("application_documents.remove_attached")}</Button>
                  </Stack>
                </>
              )}
            </Stack>
            <Alert severity="info">{t("application_documents.unsigned")}</Alert>
            {renderEditor("recommendation")}
          </Stack>
        </DocumentPanel>
      </Stack>
    </Paper>
  );
}

export default function CvApplicationDocuments({ view, onDenial }: Props) {
  const { active, scope: [, owner, version] } = useProfileScope();
  if (!active || owner === undefined || !view.receipt.draft || !view.receipt.review) return null;
  return <ApplicationDocumentsEditor key={`${owner}:${version}:${view.receipt.id}`}
    view={view} owner={owner} version={version} revision={view.receipt.review.revision} onDenial={onDenial} />;
}
