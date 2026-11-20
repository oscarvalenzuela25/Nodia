import { Button, LinearProgress, Stack, Typography } from "@mui/material";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import { useTranslation } from "react-i18next";
import TeacherLoading from "../TeacherLoading";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import { enabled } from "../../infrastructure/presentation";
import type { Job } from "../../infrastructure/schemas";
import { Actions } from "../../pages/Teacher/styles";
import { Status, StatusNotice } from "./styles";
import { jobErrorKey, jobExpectedResultKey } from "./presentation";
import { useJobStatus, type JobStatusCallbacks } from "./useJobStatus";

type StatusProps = {
  allowNew?: boolean;
  presentation?: "panel" | "inline";
  query: ReturnType<typeof useJobStatus>;
  paused: boolean;
  busy: boolean;
  onContinue: (job: Job) => Promise<void>;
  onNew: (job: Job) => Promise<void>;
};

export default function JobPanel({ jobId, onReady, onTerminal, ...props }: Omit<StatusProps, "query"> & JobStatusCallbacks & { jobId: string }) {
  const query = useJobStatus(jobId, props.paused, { onReady, onTerminal });
  return <JobStatus {...props} query={query} />;
}

export function JobStatus({ allowNew = true, presentation = "panel", query, paused, busy, onContinue, onNew }: StatusProps) {
  const { t } = useTranslation();
  const job = query.data;
  const pending = job?.state === "queued" || job?.state === "running";
  const preparing = !paused && pending;
  const canReadStatus = !query.isError && (
    job?.state === "unknown" || (pending && (paused || job.retry_after_ms === null))
  );
  const errorKey = jobErrorKey(job?.error_code ?? null, job?.state === "failed_known");
  const canRequestNew = allowNew && enabled(job?.allowed_actions ?? {}, "request_new_generation");
  const canContinue = enabled(job?.allowed_actions ?? {}, "continue_before_dispatch");
  const disabled = busy || query.isFetching;
  const severity = job?.state === "failed_known" ? "error" : job?.state === "unknown" || job?.state === "blocked_paused" ? "warning"
    : job?.state === "ready" ? "success" : "info";

  return <Status data-teacher-job-status>
    {presentation === "panel" && <Typography variant="subtitle1">{t("teacher:preparation")}</Typography>}
    <QueryErrorAlert retryVariant="outlined" isError={query.isError} isFetching={query.isFetching} onRetry={query.refetch} />
    <TeacherLoading compact={presentation === "inline"} loading={query.isLoading && !job}>
      {job ? <StatusNotice severity={severity} variant="outlined" role={severity === "error" ? "alert" : "status"}>
        <Stack sx={{ gap: 1 }}>
          <Typography variant="subtitle2">{t(`teacher:jobs.${job.state}`)}</Typography>
          {preparing && <Typography variant="body2">{t(jobExpectedResultKey(job.purpose))}</Typography>}
          {job.state === "blocked_paused" && <Typography variant="body2">{t("teacher:job_paused_help")}</Typography>}
          {job.state === "ready" && (job.purpose === "plan_outline" || job.purpose === "plan_adjustment") &&
            <Typography variant="body2">{t("teacher:job_proposal_review_help")}</Typography>}
          {job.state === "unknown" && <Typography variant="body2">{t("teacher:unknown_notice")}</Typography>}
          {query.isError && <Typography variant="body2" color="text.secondary">{t("teacher:job_last_known_state")}</Typography>}
          {errorKey && <>
            <Typography variant="body2">{t(errorKey)}</Typography>
            {errorKey === "teacher:job_error_native_excluded" && canRequestNew &&
              <Typography variant="body2">{t("teacher:job_error_native_excluded_retry")}</Typography>}
            <Typography variant="body2" color="text.secondary">{t("teacher:generation_blocked")}</Typography>
          </>}
          {canReadStatus && <Typography variant="body2" color="text.secondary">{t("teacher:job_refresh_read_help")}</Typography>}
          {canRequestNew && <Typography variant="body2" color="text.secondary">{t("teacher:job_new_intention_help")}</Typography>}
          {(preparing || job.state === "unknown" || job.state === "blocked_paused") &&
            <Typography variant="body2" color="text.secondary">{t("teacher:job_return_help")}</Typography>}
          {preparing && <LinearProgress aria-label={t("teacher:preparation_progress")} sx={{ borderRadius: 1 }} />}
        </Stack>
      </StatusNotice> : !query.isError && <StatusNotice severity="info" variant="outlined" role="status">{t("teacher:job_no_confirmed_state")}</StatusNotice>}
    </TeacherLoading>
    {job && (canReadStatus || canContinue || canRequestNew) && <Actions>
      {canReadStatus && <Button variant="outlined" startIcon={<RefreshOutlined />} disabled={disabled} onClick={() => void query.refetch()}>{t("teacher:refresh_status")}</Button>}
      {canContinue && <Button variant="outlined" disabled={disabled} onClick={() => void onContinue(job)}>{t("teacher:continue_preparation")}</Button>}
      {canRequestNew && <Button variant="contained" disabled={disabled} onClick={() => void onNew(job)}>{t("teacher:new_generation")}</Button>}
    </Actions>}
  </Status>;
}
