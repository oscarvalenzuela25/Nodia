import { useEffect, useRef } from "react";
import type { Job } from "../../infrastructure/schemas";
import { useTeacherJob } from "../../infrastructure/useServices";

export type JobStatusCallbacks = {
  onReady: (job: Job) => void;
  onTerminal?: (job: Job) => void;
};

export function useJobStatus(jobId: string | null, paused: boolean, { onReady, onTerminal }: JobStatusCallbacks) {
  const query = useTeacherJob(jobId, paused);
  const job = query.data;
  const delivered = useRef<string | null>(null);

  useEffect(() => {
    if (!job || ["queued", "running", "blocked_paused"].includes(job.state) || delivered.current === job.job_id) return;
    delivered.current = job.job_id;
    if (job.state === "ready") onReady(job);
    else onTerminal?.(job);
  }, [job, onReady, onTerminal]);

  return query;
}
