import { useEffect, useRef } from "react";
import { Alert, Button, IconButton, LinearProgress, Stack, Tooltip, Typography } from "@mui/material";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import { useTranslation } from "react-i18next";
import TeacherLoading from "../TeacherLoading";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import { useTeacherJob } from "../../infrastructure/useServices";
import { enabled } from "../../infrastructure/presentation";
import type { Job } from "../../infrastructure/schemas";
import { Actions } from "../../pages/Teacher/styles";
import { InlineStatusRow, InlineStatusValue, ProgressSpace, StateChip, Status } from "./styles";
import { jobErrorKey } from "./presentation";

type Props = { allowNew?: boolean; presentation?: "panel" | "inline"; jobId: string; paused: boolean; busy: boolean; onReady: (job: Job) => void; onTerminal?: (job: Job) => void; onContinue: (job: Job) => Promise<void>; onNew: (job: Job) => Promise<void> };
export default function JobPanel({ allowNew = true, presentation = "panel", jobId, paused, busy, onReady, onTerminal, onContinue, onNew }: Props) {
  const { t } = useTranslation();
  const query = useTeacherJob(jobId, paused);
  const delivered = useRef<string | null>(null);
  const job = query.data;
  const preparing = !paused && (job?.state === "queued" || job?.state === "running");
  const errorKey = jobErrorKey(job?.error_code ?? null, job?.state === "failed_known");
  const canRequestNew = allowNew && enabled(job?.allowed_actions ?? {}, "request_new_generation");
  const disabled = busy || query.isFetching;
  useEffect(() => {
    if (!job || ["queued", "running", "blocked_paused"].includes(job.state) || delivered.current === job.job_id) return;
    delivered.current = job.job_id;
    if (job.state === "ready") onReady(job);
    else onTerminal?.(job);
  }, [job, onReady, onTerminal]);
  const feedback = job && <>
      {job.state === "unknown" && <Typography variant="body2">{t("teacher:unknown_notice")}</Typography>}
      {query.isError && <Typography variant="body2" color="text.secondary">{t("teacher:job_last_known_state")}</Typography>}
      {errorKey && <><Typography variant="body2">{t(errorKey)}</Typography>{errorKey === "teacher:job_error_native_excluded" && canRequestNew && <Typography variant="body2">{t("teacher:job_error_native_excluded_retry")}</Typography>}<Typography variant="body2" color="text.secondary">{t("teacher:generation_blocked")}</Typography></>}
  </>;
  const recoveryActions = job && <>
        {enabled(job.allowed_actions, "continue_before_dispatch") && <Button variant="outlined" disabled={disabled} onClick={() => void onContinue(job)}>{t("teacher:continue_preparation")}</Button>}
        {canRequestNew && <Button variant="contained" disabled={disabled} onClick={() => void onNew(job)}>{t("teacher:new_generation")}</Button>}
  </>;
  if (presentation === "inline") return <Status aria-live="polite" sx={{ gap: 1 }}>
    <InlineStatusRow>
      <InlineStatusValue><TeacherLoading compact loading={query.isLoading && !job}>
        {job ? <StateChip size="small" color={job.state === "ready" ? "success" : job.state === "failed_known" ? "error" : job.state === "unknown" || job.state === "blocked_paused" ? "warning" : job.state === "cancelled_before_dispatch" ? "default" : "info"} label={t(`teacher:jobs.${job.state}`)} />
          : !query.isError && <Typography variant="body2" color="text.secondary">{t("teacher:job_no_confirmed_state")}</Typography>}
      </TeacherLoading></InlineStatusValue>
      <Tooltip title={t("teacher:refresh_status")}><span><IconButton aria-label={t("teacher:refresh_status")} disabled={disabled || query.isLoading} loading={query.isFetching} onClick={() => void query.refetch()} sx={{ width: 44, height: 44 }}><RefreshOutlined /></IconButton></span></Tooltip>
    </InlineStatusRow>
    <ProgressSpace>{preparing && <LinearProgress aria-label={t("teacher:preparation_progress")} sx={{ height: 2, borderRadius: 1 }} />}</ProgressSpace>
    <QueryErrorAlert retryVariant="outlined" isError={query.isError} isFetching={query.isFetching} onRetry={query.refetch} />
    {job && <Stack sx={{ gap: 1 }}>
      {feedback}
      {(enabled(job.allowed_actions, "continue_before_dispatch") || canRequestNew) && <Actions>
        {recoveryActions}
      </Actions>}
    </Stack>}
  </Status>;
  return <Status aria-live="polite">
    <Typography variant="subtitle1">{t("teacher:preparation")}</Typography>
    <QueryErrorAlert retryVariant="outlined" isError={query.isError} isFetching={query.isFetching} onRetry={query.refetch} />
    <ProgressSpace>{preparing && <LinearProgress aria-label={t("teacher:preparation_progress")} />}</ProgressSpace>
    <TeacherLoading loading={query.isLoading && !job}>
    <Stack sx={{ gap: 2 }}>
    {job && <>
      <Alert severity={job.state === "unknown" || job.state === "failed_known" ? "warning" : job.state === "ready" ? "success" : "info"}>{t(`teacher:jobs.${job.state}`)}</Alert>
      {feedback}
      <Actions>
        <Button variant="contained" startIcon={<RefreshOutlined />} disabled={disabled} onClick={() => void query.refetch()}>{t("teacher:refresh_status")}</Button>
        {recoveryActions}
      </Actions>
    </>}
    {!job && !query.isError && <Typography color="text.secondary">{t("teacher:job_no_confirmed_state")}</Typography>}
    </Stack>
    </TeacherLoading>
  </Status>;
}
