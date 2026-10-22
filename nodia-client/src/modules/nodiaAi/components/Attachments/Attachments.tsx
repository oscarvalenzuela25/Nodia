import { useEffect, useRef } from "react";
import { Alert, Box, Button, LinearProgress, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import { useAttachmentCapabilities } from "./hooks/useAttachmentDrafts";
import TextInput from "../../../../components/inputs/TextInput";
import type { AttachmentPanelProps } from "./types";
import { AttachmentCard, AttachmentPanel } from "./styles";
import { useVoiceRecording } from "./hooks/useVoiceRecording";

export default function Attachments({ draft, disabled, onRecordingChange, conversationId, conversationRevision }: AttachmentPanelProps) {
  const { t } = useTranslation("nodiaAi");
  const input = useRef<HTMLInputElement | null>(null);
  const capabilities = useAttachmentCapabilities(conversationId, conversationRevision);
  const voice = useVoiceRecording(file => draft.add([file]), code => sileo.error({ title: t(`attachments.${code}`) }), !disabled && !capabilities.isError && !!capabilities.data, capabilities.data?.limits);
  const recording = voice.state !== "idle";
  useEffect(() => { onRecordingChange(recording); return () => onRecordingChange(false); }, [onRecordingChange, recording]);
  const busy = disabled || draft.busy || recording || capabilities.isFetching || capabilities.isError || !capabilities.data;
  return <AttachmentPanel aria-label={t("attachments.title")}>
    <Typography variant="subtitle2">{t("attachments.title")}</Typography>
    {capabilities.data && <Typography variant="caption" color="text.secondary">{t("attachments.limits", { count: capabilities.data.limits.files_per_message, fileMiB: capabilities.data.limits.file_bytes / 1048576, messageMiB: capabilities.data.limits.message_files_bytes / 1048576, minutes: capabilities.data.limits.audio_seconds / 60 })}</Typography>}
    {capabilities.isError && <Alert severity="error" action={<Button disabled={capabilities.isFetching} onClick={() => void capabilities.refetch()}>{t("retry")}</Button>}>{t("attachments.capabilities_error")}</Alert>}
    <Alert severity="info">{t("attachments.review_mode")}</Alert>
    <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,audio/webm,audio/ogg,audio/mpeg,audio/mp4,audio/wav" hidden aria-label={t("attachments.choose")} onChange={event => { draft.add(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", flexDirection: { xs: "column", sm: "row" } }}>
      <Button disabled={busy || draft.entries.length >= (capabilities.data?.limits.files_per_message ?? 0)} onClick={() => input.current?.click()}>{t("attachments.choose")}</Button>
      <Button disabled={disabled || draft.busy || voice.state === "requesting" || (!recording && (busy || !voice.supported || draft.entries.length >= (capabilities.data?.limits.files_per_message ?? 0)))} color={recording ? "error" : "primary"} onClick={() => recording ? voice.stop() : void voice.start()}>
        {t(recording ? "attachments.stop" : "attachments.record")}{voice.state === "recording" ? ` · ${Math.floor(voice.seconds / 60)}:${String(voice.seconds % 60).padStart(2, "0")}` : ""}
      </Button>
    </Box>
    {!voice.supported && <Typography variant="caption" color="text.secondary">{t("attachments.recording_unavailable")}</Typography>}
    {draft.entries.map(entry => {
      const ready = entry.attachment?.state === "ready";
      const reviewed = ready && entry.attachment?.interpretation?.reviewed === true && entry.attachment.interpretation.text === entry.text;
      return <AttachmentCard key={entry.localId}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{entry.file.name}</Typography>
        <Typography variant="caption" color="text.secondary">{t("attachments.bytes", { count: entry.file.size })} · {t(`attachments.states.${entry.attachment?.state ?? "local"}`)}</Typography>
        {entry.busy && <LinearProgress aria-label={t("attachments.progress")} variant={entry.progress === null ? "indeterminate" : "determinate"} value={entry.progress ?? undefined} />}
        {entry.error && <Alert severity="warning">{t(`attachments.${entry.error}`)}</Alert>}
        {ready && !capabilities.isFetching && !capabilities.isError && entry.attachment?.media_type && capabilities.data?.native_media_types?.some(mime => mime === entry.attachment!.media_type) && <Alert severity="success">{t("attachments.native_ready")}</Alert>}
        {ready && <>
          <TextInput multiline minRows={2} maxRows={6} label={t(entry.attachment?.kind === "audio" ? "attachments.transcript" : "attachments.extraction")} value={entry.text} disabled={busy} onChange={event => draft.edit(entry.localId, event.target.value)} />
          <Typography variant="caption" color="text.secondary">{t("attachments.review_help")}</Typography>
        </>}
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", flexDirection: { xs: "column", sm: "row" } }}>
          {!ready && <Button disabled={busy || ["expired", "rejected"].includes(entry.attachment?.state ?? "")} onClick={() => void draft.upload(entry.localId)}>{t(entry.uncertain ? "attachments.recover" : "attachments.upload")}</Button>}
          {ready && <Button disabled={busy || reviewed || !entry.text.trim() || new TextEncoder().encode(entry.text).length > 32768} onClick={() => void draft.review(entry.localId)}>{t(reviewed ? "attachments.reviewed" : "attachments.accept_review")}</Button>}
          {entry.textDirty && <Button disabled={busy} onClick={() => draft.resetReview(entry.localId)}>{t("attachments.discard_edit")}</Button>}
          <Button disabled={busy} color="error" onClick={() => void draft.remove(entry.localId)}>{t("attachments.remove")}</Button>
        </Box>
      </AttachmentCard>;
    })}
  </AttachmentPanel>;
}
