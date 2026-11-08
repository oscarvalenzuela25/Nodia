import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Alert, Box, Button, IconButton, LinearProgress, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import AttachFileOutlined from "@mui/icons-material/AttachFileOutlined";
import { useTranslation } from "react-i18next";
import MessageComposer from "../../../../components/MessageComposer";
import Attachments from "../Attachments";
import { NODIA_AI_MESSAGE_TEXT_BYTES } from "../../infrastructure/schemas";
import { isInvoiceOcrReference } from "../Attachments/hooks/useAttachmentDrafts";
import { ReviewArea } from "./styles";
import type { ChatComposerProps } from "./types";

/** NodiaAI keeps its attachment/admission policy around the shared text editor. */
export default function ChatComposer(props: ChatComposerProps) {
  const { t } = useTranslation("nodiaAi");
  const { draft, disabled, sendDisabled, recovering, onRecordingChange } = props;
  const input = useRef<HTMLInputElement>(null);
  const actionsId = useId();
  const [actionsAnchor, setActionsAnchor] = useState<HTMLElement | null>(null);
  const [showAttachments, setShowAttachments] = useState(false);
  const [recording, setRecording] = useState(false);
  const { capabilities, enableCapabilities } = draft;
  useEffect(() => { enableCapabilities(); }, [enableCapabilities]);
  const recordingChanged = useCallback((value: boolean) => { setRecording(value); onRecordingChange(value); }, [onRecordingChange]);
  const remainingTextBytes = Math.max(0, NODIA_AI_MESSAGE_TEXT_BYTES - draft.reviewedTextBytes);
  const busy = disabled || draft.busy || capabilities.isFetching;
  const fileDisabled = busy || recording || capabilities.isError || !capabilities.data
    || draft.entries.length >= (capabilities.data?.limits.files_per_message ?? 0);
  const hasUnreviewed = draft.entries.some(entry => entry.attachment?.state === "ready" && entry.attachment.interpretation?.reviewed !== true
    && !capabilities.data?.native_media_types?.some(mime => mime === entry.attachment?.media_type) && !isInvoiceOcrReference(entry, draft.invoiceOcr));
  const addFiles = (files: File[]) => {
    if (fileDisabled || !files.length) return;
    draft.add(files);
    setShowAttachments(true);
  };
  return <MessageComposer scopeKey={props.conversationId} text={props.text} onTextChange={props.onTextChange} onSend={props.onSend}
    maxBytes={remainingTextBytes} disabled={draft.busy || capabilities.isFetching || (disabled && !recovering)}
    inputDisabled={disabled || recovering} voiceDisabled={disabled || recovering || draft.busy}
    sendDisabled={sendDisabled} submitOnEnter={!recovering} textTooLarge={props.textTooLarge}
    label={t("message")} placeholder={t("composer.placeholder")} ariaLabel={t("composer.title")} sendLabel={t(recovering ? "recover_send" : "send")}
    onRecordingChange={recordingChanged} onPaste={event => {
      const files = Array.from(event.clipboardData.files);
      if (!files.length) return;
      // Media follows this wrapper's admission/review; ordinary text paste remains native.
      event.preventDefault();
      addFiles(files);
    }} beforeInput={<>
    {recovering && <Alert severity="warning">{t("send_uncertain")}</Alert>}
    {capabilities.isFetching && <LinearProgress aria-label={t("refreshing")} sx={{ height: 2, borderRadius: 1 }} />}
    {capabilities.isError && <Alert severity="error" action={<Button disabled={busy || recording} onClick={() => void draft.refreshCapabilities()}>{t("retry")}</Button>}>{t("attachments.capabilities_error")}</Alert>}
    <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,audio/webm,audio/ogg,audio/mpeg,audio/mp4,audio/wav" hidden aria-label={t("attachments.choose")}
      onChange={event => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
    {draft.entries.length > 0 && <Box data-attachment-group data-composer-review>
      <Button size="small" disabled={busy || recording} aria-expanded={showAttachments} onClick={() => setShowAttachments(value => !value)}>
        {t("composer.files", { count: draft.entries.length })} · {t(draft.ready ? "composer.files_ready" : "composer.files_review")}
      </Button>
      {showAttachments && <ReviewArea><Attachments reviewOnly conversationId={props.conversationId} conversationRevision={props.conversationRevision}
        draft={draft} disabled={disabled || recording} onRecordingChange={onRecordingChange} />
        {hasUnreviewed && <Button size="small" disabled={busy || recording} onClick={() => void draft.refreshCapabilities()}>{t("attachments.recheck_capabilities")}</Button>}
      </ReviewArea>}
    </Box>}
    </>} toolbarStart={<>
      <Tooltip title={t("composer.actions")}><span><IconButton id={`${actionsId}-trigger`} aria-label={t("composer.actions")} aria-haspopup="menu"
        aria-expanded={Boolean(actionsAnchor)} aria-controls={actionsAnchor ? actionsId : undefined}
        disabled={fileDisabled} onClick={event => setActionsAnchor(event.currentTarget)} sx={{ width: 44, height: 44, borderRadius: 3 }}><AddOutlined /></IconButton></span></Tooltip>
      <Menu id={actionsId} anchorEl={actionsAnchor} open={Boolean(actionsAnchor)} onClose={() => setActionsAnchor(null)}
        slotProps={{ list: { "aria-labelledby": `${actionsId}-trigger` }, paper: { sx: { minWidth: 200, maxWidth: "calc(100vw - 32px)" } } }}>
        <MenuItem disabled={fileDisabled} onClick={() => { setActionsAnchor(null); input.current?.click(); }} sx={{ minHeight: 44 }}>
          <ListItemIcon><AttachFileOutlined fontSize="small" /></ListItemIcon><ListItemText>{t("composer.attach_file")}</ListItemText>
        </MenuItem>
      </Menu>
    </>} footer={props.footer} />;
}
