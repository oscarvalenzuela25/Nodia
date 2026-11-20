import { useId, type Ref } from "react";
import { Button, Typography } from "@mui/material";
import { ArrowForwardOutlined, AutoStoriesOutlined, PlayArrowOutlined } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import type { StudyContinuation as Continuation } from "../../infrastructure/studyContinuation";
import { StateChip } from "../JobPanel/styles";
import { Actions, ContinuationPanel, Context, LessonTitle, PreparationProgress } from "./styles";

type Props = {
  view: Continuation;
  paused: boolean;
  busy: boolean;
  headingRef?: Ref<HTMLHeadingElement>;
  preparationState?: "queued" | "running" | null;
  jobReadError?: { busy: boolean; onRetry: () => unknown };
  onSelectUnit: (sectionId: string, unitId: string) => void;
  onPrepare: (unitId: string) => void;
  onOpen: () => void;
  onContinue: () => void;
  onInspectJob: (jobId: string) => void;
  onRefresh?: () => void;
};

export default function StudyContinuation({ view, paused, busy, headingRef, preparationState, jobReadError, onSelectUnit, onPrepare, onOpen, onContinue, onInspectJob, onRefresh }: Props) {
  const { t } = useTranslation();
  const headingId = useId();
  const actionable = ["first", "prepare", "open", "continue", "job"].includes(view.kind);
  const disabled = busy || (view.kind === "prepare" && !view.canPrepare) || (view.kind === "first" && paused);
  const run = () => {
    if (disabled) return;
    if (view.kind === "first" && view.target) onSelectUnit(view.target.sectionId, view.target.unitId);
    if (view.kind === "prepare" && view.target) onPrepare(view.target.unitId);
    if (view.kind === "open") onOpen();
    if (view.kind === "continue") onContinue();
    if (view.kind === "job" && view.jobId) onInspectJob(view.jobId);
  };
  const actionKey = view.kind === "prepare" && view.firstLesson ? "prepare_first" : view.kind;
  if (preparationState) return <ContinuationPanel aria-labelledby={headingId}>
    <Context>
      <Typography ref={headingRef} tabIndex={-1} id={headingId} variant="h5" component="h2" sx={{ fontWeight: 700 }}>{t("teacher:continuation.preparing_lesson")}</Typography>
      <StateChip role="status" size="small" color="info" label={t(`teacher:jobs.${preparationState}`)} sx={{ alignSelf: "flex-start" }} />
    </Context>
    <LessonTitle>{view.target?.title}</LessonTitle>
    <PreparationProgress aria-label={t("teacher:preparation_progress")} />
    {jobReadError && <QueryErrorAlert retryVariant="outlined" isError isFetching={jobReadError.busy} onRetry={jobReadError.onRetry} />}
    <Context>
      <Typography>{t("teacher:job_material_expected")}</Typography>
      {jobReadError && <Typography color="text.secondary">{t("teacher:job_last_known_state")}</Typography>}
      <Typography color="text.secondary">{t("teacher:job_return_help")}</Typography>
    </Context>
  </ContinuationPanel>;

  return <ContinuationPanel aria-labelledby={headingId}>
    <Context>
      <Typography variant="overline" color="primary">{t("teacher:continuation.eyebrow")}</Typography>
      <Typography ref={headingRef} tabIndex={-1} id={headingId} variant="h5" component="h2">{t(`teacher:continuation.titles.${view.kind}`)}</Typography>
      {view.target && <LessonTitle>{view.target.title}</LessonTitle>}
      <Typography color="text.secondary">{t(`teacher:continuation.descriptions.${view.kind}`)}</Typography>
      {view.kind === "prepare" && !view.canPrepare && <Typography color="text.secondary" variant="body2">{t("teacher:continuation.preparation_unavailable")}</Typography>}
    </Context>
    {actionable && <Actions><Button variant="contained" disabled={disabled} onClick={run} startIcon={view.kind === "prepare" ? <AutoStoriesOutlined /> : view.kind === "continue" ? <PlayArrowOutlined /> : <ArrowForwardOutlined />}>
      {t(`teacher:continuation.actions.${actionKey}`)}
    </Button></Actions>}
    {(view.kind === "unknown" || view.kind === "preparing") && onRefresh && <Actions><Button variant="outlined" disabled={busy} onClick={() => { if (!busy) onRefresh(); }}>{t("teacher:refresh_status")}</Button></Actions>}
  </ContinuationPanel>;
}
