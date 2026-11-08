import { useEffect } from "react";
import { Alert, Box, IconButton, Tooltip, Typography } from "@mui/material";
import MicNoneOutlined from "@mui/icons-material/MicNoneOutlined";
import StopRounded from "@mui/icons-material/StopRounded";
import SendRounded from "@mui/icons-material/SendRounded";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import TextInput from "../inputs/TextInput";
import VoiceActivity from "../VoiceActivity";
import { useVoiceDictation } from "../../hooks/useVoiceDictation";
import { ComposerShell, InputRow, MessageInput, Toolbar } from "./styles";
import type { MessageComposerProps } from "./types";

/** Shared text/dictation surface. Owners supply their own send policy and optional slots. */
export default function MessageComposer({ scopeKey, text, onTextChange, onSend, maxBytes, maxLength,
  label, placeholder, sendLabel, ariaLabel = label, disabled = false, sendDisabled = false,
  inputDisabled = false, voiceDisabled, submitOnEnter = true, textTooLarge = false,
  onRecordingChange, onPaste, beforeInput, toolbarStart, footer, sx }: MessageComposerProps) {
  const { t, i18n } = useTranslation("core");
  const validLimits = Number.isSafeInteger(maxBytes) && maxBytes >= 0
    && (maxLength === undefined || (Number.isSafeInteger(maxLength) && maxLength >= 0));
  const textBytes = new TextEncoder().encode(text).length;
  const overLimit = !validLimits || textTooLarge || textBytes > maxBytes || (maxLength !== undefined && text.length > maxLength);
  const atLimit = !validLimits || textBytes >= maxBytes || (maxLength !== undefined && text.length >= maxLength);
  const voiceLocked = voiceDisabled ?? disabled;
  const voice = useVoiceDictation({ enabled: !voiceLocked, scopeKey, language: i18n.resolvedLanguage ?? i18n.language,
    text, maxBytes, maxLength, onTextChange,
    onError: code => sileo.error({ title: t(`message_composer.dictation.errors.${code}`) }),
  });
  const recording = voice.state !== "idle";
  useEffect(() => {
    onRecordingChange?.(recording);
    return () => onRecordingChange?.(false);
  }, [onRecordingChange, recording]);
  const canSend = !disabled && !sendDisabled && !overLimit && !recording;
  return <ComposerShell aria-label={ariaLabel} sx={sx} onSubmit={event => { event.preventDefault(); if (canSend) onSend(); }}>
    {beforeInput}
    <InputRow>
      <MessageInput onPaste={onPaste} onKeyDown={event => {
        if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
        event.preventDefault();
        if (!event.repeat && canSend && submitOnEnter) onSend();
      }}>
        <TextInput label={label} placeholder={placeholder} value={text} onChange={event => onTextChange(event.target.value)}
          multiline minRows={1} maxRows={5} disabled={disabled || inputDisabled || recording} />
      </MessageInput>
      <Tooltip title={t(voice.state === "requesting" ? "message_composer.dictation.cancel" : recording ? "message_composer.dictation.stop" : !voice.supported ? "message_composer.dictation.unsupported" : atLimit ? "message_composer.dictation.errors.text_too_large" : "message_composer.dictation.start")}>
        <span><IconButton aria-label={t(voice.state === "requesting" ? "message_composer.dictation.cancel" : recording ? "message_composer.dictation.stop" : "message_composer.dictation.start")} color={recording ? "error" : "default"}
          disabled={voiceLocked || voice.state === "stopping" || (!recording && (!voice.supported || atLimit))}
          onClick={() => voice.state === "requesting" ? voice.cancel() : recording ? voice.stop() : void voice.start()} sx={{
            width: 44, height: 44, borderRadius: 3, bgcolor: "action.hover", border: "1px solid", borderColor: "divider",
            transition: "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
            "&:hover": { bgcolor: "action.selected", borderColor: recording ? "error.main" : "primary.main", color: recording ? "error.main" : "primary.main", cursor: "pointer" },
            "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
          }}>{recording ? <StopRounded /> : <MicNoneOutlined />}</IconButton></span>
      </Tooltip>
      <Tooltip title={sendLabel}><span><IconButton type="submit" aria-label={sendLabel} disabled={!canSend}
        sx={{ width: 44, height: 44, borderRadius: 3, bgcolor: "primary.main", color: "primary.contrastText", "&:hover": { bgcolor: "primary.dark" }, "&.Mui-disabled": { bgcolor: "action.disabledBackground" } }}><SendRounded sx={{ fontSize: 21 }} /></IconButton></span></Tooltip>
    </InputRow>
    {recording && <Box sx={{ minWidth: 0 }}>
      <Typography role="status" variant="caption" color="error.main">{t(voice.state === "requesting" ? "message_composer.dictation.requesting" : voice.state === "stopping" ? "message_composer.dictation.stopping" : "message_composer.dictation.listening", { time: `${Math.floor(voice.seconds / 60)}:${String(voice.seconds % 60).padStart(2, "0")}` })}</Typography>
      {voice.state !== "stopping" && <VoiceActivity stream={voice.stream} />}
      <Typography variant="caption" color="text.secondary">{t("message_composer.dictation.notice")}</Typography>
    </Box>}
    {overLimit && <Alert severity="warning">{t("message_composer.text_too_large")}</Alert>}
    {(toolbarStart || footer) && <Toolbar>{toolbarStart}<Box data-composer-footer data-composer-selection>{footer}</Box></Toolbar>}
  </ComposerShell>;
}
