import type { EntityManager } from 'typeorm';
/** No timer or client assertion can retire an uncertain grading owner. */
export async function pendingClosureReason(
  m: EntityManager,
  sessionId: string,
  attemptId: string,
): Promise<string | null> {
  const jobs: {
    id: string;
    state: string;
    blocks_duplicate: boolean;
    result_ref: unknown;
    phase: string | null;
    acknowledged_at: Date | null;
    terminal_proof: unknown;
  }[] = await m.query(
    "SELECT j.id,j.state,j.blocks_duplicate,j.result_ref,o.phase,o.acknowledged_at,o.terminal_proof FROM teacher_generation_jobs j LEFT JOIN LATERAL(SELECT phase,acknowledged_at,terminal_proof FROM ai_generation_operations WHERE teacher_job_id=j.id ORDER BY created_at DESC LIMIT 1)o ON true WHERE j.session_id=$1 AND j.attempt_id=$2 AND j.purpose='written_feedback'",
    [sessionId, attemptId],
  );
  if (
    jobs.some((j) => ['queued', 'running', 'blocked_paused'].includes(j.state))
  )
    return null;
  const unknown = jobs.filter((j) => j.state === 'unknown');
  if (
    unknown.some(
      (j) =>
        j.phase !== 'closed' ||
        !j.acknowledged_at ||
        !j.terminal_proof ||
        j.blocks_duplicate ||
        j.result_ref,
    )
  )
    return null;
  if (unknown.length) return 'feedback_unknown_unrecoverable';
  const [review]: { n: string }[] = await m.query(
    "SELECT count(*)::text AS n FROM teacher_responses WHERE attempt_id=$1 AND grade_state='needs_review'",
    [attemptId],
  );
  if (Number(review.n)) return 'needs_review';
  if (jobs.some((j) => j.state === 'failed_known')) return 'feedback_failed';
  return null;
}
