import { useEffect, useRef, useState } from "react";
import Button from "@mui/material/Button";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import { getHttpErrorMessage } from "../../../../config/httpFeedback";
import { useConnectionStatus } from "../../../../pwa/useConnectionStatus";
import { TEACHER_DOWNLOADS_ROUTE } from "../../constants/routes";
import { downloadLesson, type DownloadLessonInput } from "../../infrastructure/downloadLesson";
import { OfflineStudyError } from "../../infrastructure/offlineStudy";

export default function OfflineLessonDownload({ disabled, ...lesson }: DownloadLessonInput & { disabled: boolean }) {
  const { t } = useTranslation("teacher");
  const { status } = useConnectionStatus();
  const pending = useRef<AbortController | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string>();
  useEffect(() => () => pending.current?.abort(), []);

  async function download() {
    if (disabled || pending.current || status === "offline") return;
    const controller = new AbortController();
    pending.current = controller;
    setSaving(true);
    try {
      const copy = await downloadLesson(lesson, controller.signal);
      if (controller.signal.aborted) return;
      setSaved(copy.id);
      sileo.success({ title: t("offline_study.saved") });
    } catch (error) {
      if (controller.signal.aborted) return;
      const description = error instanceof OfflineStudyError
        ? t(`offline_study.errors.${error.code}`)
        : error instanceof DOMException && error.name === "QuotaExceededError"
          ? t("offline_study.errors.quota")
          : getHttpErrorMessage(error);
      sileo.error({ title: t("offline_study.failed"), description });
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        if (!controller.signal.aborted) setSaving(false);
      }
    }
  }

  return <>
    <Button variant="outlined" startIcon={<DownloadOutlined />} sx={{ minHeight: 44 }}
      disabled={disabled || status === "offline"} loading={saving} onClick={() => void download()}>
      {t("offline_study.download")}
    </Button>
    {saving && <Button variant="outlined" onClick={() => {
      pending.current?.abort(); pending.current = null; setSaving(false);
    }}>{t("offline_study.cancel")}</Button>}
    {saved && <Button variant="outlined" href={`${TEACHER_DOWNLOADS_ROUTE}#${encodeURIComponent(saved)}`} sx={{ minHeight: 44 }}>
      {t("offline_study.open")}
    </Button>}
  </>;
}
