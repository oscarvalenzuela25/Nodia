import { useEffect, useRef, useState } from "react";
import Button from "@mui/material/Button";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import { getHttpErrorMessage } from "../../../../config/httpFeedback";
import { useConnectionStatus } from "../../../../pwa/useConnectionStatus";
import useAuthStore from "../../../../store/authStore";
import { TEACHER_DOWNLOADS_ROUTE } from "../../constants/routes";
import { downloadLesson, type DownloadLessonInput } from "../../infrastructure/downloadLesson";
import { OfflineStudyError } from "../../infrastructure/offlineStudy";
import { offlineStudyScope } from "../../infrastructure/offlineStudyIdentity";
import { offlineScopeKey, useOfflineLessonCopy } from "./hooks/useOfflineLessonCopy";
import { offlineLessonActionStyles } from "./styles";

type Props = DownloadLessonInput & { disabled: boolean };

function DownloadActions({ disabled, scope, ...lesson }: Props & { scope: string | null }) {
  const { t } = useTranslation("teacher");
  const { status } = useConnectionStatus();
  const pending = useRef<AbortController | null>(null);
  const downloadButton = useRef<HTMLButtonElement>(null);
  const openButton = useRef<HTMLAnchorElement>(null);
  const restoreFocus = useRef(false);
  const [saving, setSaving] = useState(false);
  const copyId = `${lesson.studyId}:${lesson.unitId}`.toLowerCase();
  const { copy, checking } = useOfflineLessonCopy(copyId, scope, lesson);
  const canOpen = copy === "current" || copy === "legacy";
  useEffect(() => () => pending.current?.abort(), []);

  useEffect(() => {
    if (saving || checking || !restoreFocus.current) return;
    restoreFocus.current = false;
    if (document.activeElement === document.body) (canOpen ? openButton.current : downloadButton.current)?.focus();
  }, [canOpen, checking, saving]);

  async function download() {
    if (disabled || !scope || checking || pending.current || status === "offline") return;
    restoreFocus.current = document.activeElement === downloadButton.current;
    const controller = new AbortController();
    pending.current = controller;
    setSaving(true);
    try {
      await downloadLesson(lesson, controller.signal);
      if (!controller.signal.aborted) sileo.success({ title: t("offline_study.saved") });
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
    {canOpen && <Button ref={openButton} variant="contained" startIcon={<MenuBookOutlined />}
      disabled={disabled || checking || saving} href={`${TEACHER_DOWNLOADS_ROUTE}#${encodeURIComponent(copyId)}`} sx={offlineLessonActionStyles}>
      {t("offline_study.open")}
    </Button>}
    {copy !== "current" && <Button ref={downloadButton} variant="outlined" startIcon={<DownloadOutlined />}
      disabled={disabled || !scope || status === "offline"} loading={checking || saving} onClick={() => void download()}
      sx={offlineLessonActionStyles}>
      {t(copy ? "offline_study.update" : "offline_study.download")}
    </Button>}
    {saving && <Button variant="outlined" sx={offlineLessonActionStyles} onClick={(event) => {
      restoreFocus.current = document.activeElement === event.currentTarget;
      pending.current?.abort();
      pending.current = null;
      setSaving(false);
    }}>{t("offline_study.cancel")}</Button>}
  </>;
}

export default function OfflineLessonDownload(props: Props) {
  const scope = useAuthStore(state => offlineScopeKey(offlineStudyScope(state.token, state.user?.id)));
  const key = `${scope}:${props.studyId}:${props.unitId}:${props.planRevisionId}:${props.contentVersionId}`;
  return <DownloadActions key={key} scope={scope} {...props} />;
}
