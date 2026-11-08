import type { AllowedActions, Answer, Attempt, Cursor, Job, Session } from "./schemas";

/** Historical unknown jobs remain in active_jobs even after local closure. */
export const hasPreparingJob = (jobs: Session["active_jobs"]) => jobs.some(job => job.state === "queued" || job.state === "running");

export function restoreJob(session: Pick<Session, "latest_job_id" | "active_jobs">) {
  // Current Server explicitly identifies the newest request, including ready jobs.
  // active_jobs also contains historical unknowns; use it only for older contracts.
  const jobId = session.latest_job_id !== undefined ? session.latest_job_id : session.active_jobs[0]?.job_id ?? null;
  const state = session.active_jobs.find(job => job.job_id === jobId)?.state;
  // An already-published result must not navigate away from the restored cursor.
  return { jobId, followResult: state === "queued" || state === "running" || state === "blocked_paused" };
}

export function readyJobResult(job: Pick<Job, "job_id" | "state" | "result_ref">, selection: ReturnType<typeof restoreJob>) {
  return job.state === "ready" && selection.followResult && selection.jobId === job.job_id ? job.result_ref : null;
}

export function nextAttemptId(result: Record<string, unknown> | null, currentAttemptId: string | null) {
  const id = result?.attempt_id;
  return typeof id === "string" && id !== currentAttemptId ? id : null;
}

export function restoreAttempt(cursor: Pick<Cursor, "attempt_id" | "item_id"> & { updated_at?: string }, activeAttempts: { attempt_id: string; created_at?: string }[]) {
  const cursorAt = cursor.updated_at ? Date.parse(cursor.updated_at) : NaN;
  const newer = activeAttempts.find(attempt => attempt.created_at !== undefined && Date.parse(attempt.created_at) > cursorAt);
  const attemptId = newer?.attempt_id ?? cursor.attempt_id;
  return { attemptId, questionId: attemptId === cursor.attempt_id ? cursor.item_id : null };
}

export const enabled = (actions: AllowedActions, action: string) => actions[action]?.enabled === true;
export const canPollJob = (state: string, visible: boolean, paused: boolean) => visible && !paused && (state === "queued" || state === "running");
export const sameAnswer = (left: Answer | null, right: Answer | null) => JSON.stringify(left) === JSON.stringify(right);
export const cursorBody = (cursor: Cursor) => ({ plan_revision_id: cursor.plan_revision_id, phase: cursor.phase, section_id: cursor.section_id, unit_id: cursor.unit_id, content_version_id: cursor.content_version_id, attempt_id: cursor.attempt_id, item_id: cursor.item_id, block_id: cursor.block_id });
export function resultNotice(attempt: Attempt): "pending" | "passed" | "not_passed" | "not_independent" | "practice_complete" {
  if (attempt.scope !== "section_final") return attempt.state === "graded" ? "practice_complete" : "pending";
  return attempt.result ?? "pending";
}
export function answerText(answer: unknown): string {
  if (typeof answer === "string") return answer;
  if (Array.isArray(answer)) return answer.filter((item): item is string => typeof item === "string").join(", ");
  if (answer && typeof answer === "object") {
    if ("text" in answer && typeof answer.text === "string") return answer.text;
    if ("option_id" in answer && typeof answer.option_id === "string") return answer.option_id;
    if ("alternatives" in answer) return answerText(answer.alternatives);
  }
  return "";
}
