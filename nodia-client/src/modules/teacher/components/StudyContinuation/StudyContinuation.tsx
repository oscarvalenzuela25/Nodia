import { useId } from "react";
import { Button, Typography } from "@mui/material";
import { ArrowForwardOutlined, AutoStoriesOutlined, PlayArrowOutlined } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { studyContinuation, type StudyContinuationContext } from "../../infrastructure/studyContinuation";
import { Actions, ContinuationPanel, Context } from "./styles";

type Props = StudyContinuationContext & {
  busy: boolean;
  onSelectUnit: (sectionId: string, unitId: string) => void;
  onPrepare: (unitId: string) => void;
  onOpen: () => void;
  onContinue: () => void;
  onInspectJob: (jobId: string) => void;
  onRefresh?: () => void;
};

export default function StudyContinuation({ busy, onSelectUnit, onPrepare, onOpen, onContinue, onInspectJob, onRefresh, ...context }: Props) {
  const { t } = useTranslation();
  const headingId = useId();
  const view = studyContinuation(context);
  const actionable = ["first", "prepare", "open", "continue", "job"].includes(view.kind);
  const disabled = busy || (view.kind === "prepare" && !view.canPrepare) || (view.kind === "first" && context.paused);
  const run = () => {
    if (disabled) return;
    if (view.kind === "first" && view.target) onSelectUnit(view.target.sectionId, view.target.unitId);
    if (view.kind === "prepare" && view.target) onPrepare(view.target.unitId);
    if (view.kind === "open") onOpen();
    if (view.kind === "continue") onContinue();
    if (view.kind === "job" && view.jobId) onInspectJob(view.jobId);
  };
  const actionKey = view.kind === "prepare" && view.firstLesson ? "prepare_first" : view.kind;
  return <ContinuationPanel aria-labelledby={headingId}>
    <Context>
      <Typography variant="overline" color="primary">{t("teacher:continuation.eyebrow")}</Typography>
      <Typography id={headingId} variant="h5" component="h2">{t(`teacher:continuation.titles.${view.kind}`)}</Typography>
      {view.target && <Typography variant="subtitle1" component="p" sx={{ fontWeight: 600 }}>{view.target.title}</Typography>}
      <Typography color="text.secondary">{t(`teacher:continuation.descriptions.${view.kind}`)}</Typography>
      {view.kind === "prepare" && !view.canPrepare && <Typography color="text.secondary" variant="body2">{t("teacher:continuation.preparation_unavailable")}</Typography>}
    </Context>
    {actionable && <Actions><Button variant="contained" disabled={disabled} onClick={run} startIcon={view.kind === "prepare" ? <AutoStoriesOutlined /> : view.kind === "continue" ? <PlayArrowOutlined /> : <ArrowForwardOutlined />}>
      {t(`teacher:continuation.actions.${actionKey}`)}
    </Button></Actions>}
    {(view.kind === "unknown" || view.kind === "preparing") && onRefresh && <Actions><Button variant="outlined" disabled={busy} onClick={() => { if (!busy) onRefresh(); }}>{t("teacher:refresh_status")}</Button></Actions>}
  </ContinuationPanel>;
}
