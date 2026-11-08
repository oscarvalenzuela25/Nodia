import { useEffect, useId, useRef, useState } from "react";
import { Alert, Box, Button, IconButton, LinearProgress, Tooltip, Typography } from "@mui/material";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import AudioFileOutlined from "@mui/icons-material/AudioFileOutlined";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import TextInput from "../../../../components/inputs/TextInput";
import type { AttachmentPanelProps } from "./types";
import { AttachmentCard, AttachmentHeader, AttachmentPanel, PreviewFrame } from "./styles";
import AttachmentDraftPreview from "./AttachmentDraftPreview";
import AudioPreview from "../AudioPreview";
import { useVoiceRecording } from "./hooks/useVoiceRecording";
import { isInvoiceOcrReference } from "./hooks/useAttachmentDrafts";

function FullAttachments({ draft, disabled, onRecordingChange }: AttachmentPanelProps) {
  const { t } = useTranslation("nodiaAi");
  const input = useRef<HTMLInputElement | null>(null);
  const { capabilities, enableCapabilities } = draft;
  useEffect(() => { enableCapabilities(); }, [enableCapabilities]);
  const voice = useVoiceRecording(file => draft.add([file]), code => sileo.error({ title: t(`attachments.${code}`) }), !disabled && !capabilities.isError && !!capabilities.data, capabilities.data?.limits);
  const recording = voice.state !== "idle";
  useEffect(() => { onRecordingChange(recording); return () => onRecordingChange(false); }, [onRecordingChange, recording]);
  const busy = disabled || draft.busy || recording || capabilities.isFetching || capabilities.isError || !capabilities.data;
  return <AttachmentPanel aria-label={t("attachments.title")}>
    <Typography variant="subtitle2">{t("attachments.title")}</Typography>
    {capabilities.data && <Typography variant="caption" color="text.secondary">{t("attachments.limits", { count: capabilities.data.limits.files_per_message, fileMiB: capabilities.data.limits.file_bytes / 1048576, messageMiB: capabilities.data.limits.message_files_bytes / 1048576, minutes: capabilities.data.limits.audio_seconds / 60 })}</Typography>}
    {capabilities.isError && <Alert severity="error" action={<Button variant="contained" disabled={disabled || draft.busy || recording || capabilities.isFetching} onClick={() => void draft.refreshCapabilities()}>{t("retry")}</Button>}>{t("attachments.capabilities_error")}</Alert>}
    <Alert severity="info">{t("attachments.review_mode")}</Alert>
    <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,audio/webm,audio/ogg,audio/mpeg,audio/mp4,audio/wav" hidden aria-label={t("attachments.choose")} onChange={event => { draft.add(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", flexDirection: { xs: "column", sm: "row" } }}>
      <Button variant="contained" disabled={busy || draft.entries.length >= (capabilities.data?.limits.files_per_message ?? 0)} onClick={() => input.current?.click()}>{t("attachments.choose")}</Button>
      <Button variant="contained" disabled={disabled || draft.busy || voice.state === "requesting" || (!recording && (busy || !voice.supported || draft.entries.length >= (capabilities.data?.limits.files_per_message ?? 0)))} color={recording ? "error" : "primary"} onClick={() => recording ? voice.stop() : void voice.start()}>
        {t(recording ? "attachments.stop" : "attachments.record")}{voice.state === "recording" ? ` · ${Math.floor(voice.seconds / 60)}:${String(voice.seconds % 60).padStart(2, "0")}` : ""}
      </Button>
      {draft.entries.some(entry => entry.attachment?.state === "ready" && entry.attachment.interpretation?.reviewed !== true) && <Button variant="contained" disabled={disabled || draft.busy || recording || capabilities.isFetching} onClick={() => void draft.refreshCapabilities()}>{t("attachments.recheck_capabilities")}</Button>}
    </Box>
    {!voice.supported && <Typography variant="caption" color="text.secondary">{t("attachments.recording_unavailable")}</Typography>}
    <AttachmentReview draft={draft} disabled={busy} />
  </AttachmentPanel>;
}

function AttachmentReview({ draft, disabled }: Pick<AttachmentPanelProps, "draft" | "disabled">) {
  const { t } = useTranslation("nodiaAi");
  const reviewId = useId();
  const [openReviews, setOpenReviews] = useState<string[]>([]);
  const { capabilities } = draft;
  const busy = disabled || draft.busy || capabilities.isFetching || capabilities.isError || !capabilities.data;
  return <AttachmentPanel aria-label={t("attachments.title")}>
    {draft.entries.map(entry => {
      const ready = entry.attachment?.state === "ready";
      const reviewed = ready && entry.attachment?.interpretation?.reviewed === true && entry.attachment.interpretation.text === entry.text;
      const policyReady = !capabilities.isFetching && !capabilities.isError && !!capabilities.data;
      const native = ready && policyReady && !!entry.attachment?.media_type && capabilities.data?.native_media_types?.some(mime => mime === entry.attachment!.media_type);
      const image = ["image/jpeg", "image/png", "image/webp"].includes(entry.file.type);
      const retryUpload = !ready && (entry.uncertain || entry.error === "upload_error" || entry.error === "upload_uncertain")
        && !["expired", "rejected"].includes(entry.attachment?.state ?? "");
      const expanded = entry.textDirty === true || openReviews.includes(entry.localId);
      const contentId = `${reviewId}-${entry.localId}`;
      return <AttachmentCard key={entry.localId}>
        <AttachmentHeader>
          {image ? <AttachmentDraftPreview file={entry.file} /> : <PreviewFrame aria-hidden="true">
            {entry.file.type === "application/pdf" ? <PictureAsPdfOutlined color="error" />
              : entry.file.type.startsWith("audio/") ? <AudioFileOutlined color="primary" /> : <DescriptionOutlined color="action" />}
          </PreviewFrame>}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{entry.file.name}</Typography>
            <Typography variant="caption" color="text.secondary">{t("attachments.bytes", { count: entry.file.size })} · {t(`attachments.states.${entry.attachment?.state ?? "local"}`)}</Typography>
          </Box>
          <Tooltip title={t("attachments.remove")}><span><IconButton disabled={busy} color="error"
            aria-label={t("attachments.remove")} onClick={() => void draft.remove(entry.localId)}
            sx={{ width: 44, height: 44, borderRadius: 2, "&:hover": { bgcolor: "action.hover" } }}><DeleteOutlined /></IconButton></span></Tooltip>
        </AttachmentHeader>
        {entry.file.type.startsWith("audio/") && <AudioPreview blob={entry.file} name={entry.file.name} />}
        {entry.busy && <LinearProgress aria-label={t("attachments.progress")} variant={entry.progress === null ? "indeterminate" : "determinate"} value={entry.progress ?? undefined} />}
        {entry.error && <Alert severity="warning">{t(`attachments.${entry.error}`)}</Alert>}
        {native && <Alert severity="success">{t("attachments.native_ready")}</Alert>}
        {!native && policyReady && isInvoiceOcrReference(entry, draft.invoiceOcr) && <Alert severity="info">{t("attachments.invoice_ocr_reference")}</Alert>}
        {ready && <Button type="button" size="small" disabled={busy || entry.textDirty === true}
          aria-expanded={expanded} aria-controls={contentId} sx={{ alignSelf: "flex-start" }}
          onClick={() => setOpenReviews(previous => expanded
            ? previous.filter(id => id !== entry.localId)
            : [...previous.filter(id => draft.entries.some(item => item.localId === id)), entry.localId])}>
          {t("attachments.review_content")}
        </Button>}
        {ready && <Box id={contentId} hidden={!expanded}>
          {expanded && <>
          <TextInput multiline minRows={2} maxRows={6} label={t(entry.attachment?.kind === "audio" ? "attachments.transcript" : "attachments.extraction")} value={entry.text} disabled={busy} onChange={event => draft.edit(entry.localId, event.target.value)} />
          <Typography variant="caption" color="text.secondary">{t("attachments.review_help")}</Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1, flexDirection: { xs: "column", sm: "row" } }}>
          {ready && <Button variant="contained" disabled={busy || reviewed || !entry.text.trim() || new TextEncoder().encode(entry.text).length > 32768} onClick={() => void draft.review(entry.localId)}>{t(reviewed ? "attachments.reviewed" : "attachments.accept_review")}</Button>}
          {entry.textDirty && <Button variant="contained" disabled={busy} onClick={() => draft.resetReview(entry.localId)}>{t("attachments.discard_edit")}</Button>}
          </Box>
          </>}
        </Box>}
        {retryUpload && <Button variant="outlined" disabled={busy} onClick={() => void draft.upload(entry.localId)}>{t(entry.uncertain ? "attachments.recover" : "retry")}</Button>}
      </AttachmentCard>;
    })}
  </AttachmentPanel>;
}

export default function Attachments(props: AttachmentPanelProps) {
  return props.reviewOnly ? <AttachmentReview {...props} /> : <FullAttachments {...props} />;
}
