import { useLayoutEffect, useRef, useState } from "react";
import { Alert, Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import { AudioContainer } from "./styles";
import type { AudioPreviewProps } from "./types";

/** Local playback only: this component never fetches, uploads or interprets audio. */
export default function AudioPreview({ blob, name }: AudioPreviewProps) {
  const { t } = useTranslation("nodiaAi");
  const audio = useRef<HTMLAudioElement | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<{ blob: Blob; attempt: number } | null>(null);
  const failed = failure?.blob === blob && failure.attempt === attempt;
  useLayoutEffect(() => {
    const element = audio.current;
    if (!element) return;
    const url = URL.createObjectURL(blob);
    element.src = url;
    // Replace and stop the old source before paint, so a new Blob cannot play stale bytes.
    element.load();
    return () => {
      element.pause();
      element.removeAttribute("src");
      element.load();
      URL.revokeObjectURL(url);
    };
  }, [blob, attempt]);
  return <AudioContainer>
    <audio ref={audio} controls preload="metadata" aria-label={t("attachments.audio_preview_label", { name })}
      onError={event => {
        const element = event.currentTarget;
        const source = element.getAttribute("src");
        if (!source || element.currentSrc && element.currentSrc !== source) return;
        setFailure({ blob, attempt });
      }}>{t("attachments.audio_preview_error")}</audio>
    {failed && <>
      <Alert severity="error">{t("attachments.audio_preview_error")}</Alert>
      <Button type="button" variant="outlined" onClick={() => setAttempt(value => value + 1)}>{t("attachments.audio_preview_retry")}</Button>
    </>}
  </AudioContainer>;
}
