import { actions } from './teacher-actions.js';
export function teacherJobActions(
  job: {
    state: string;
    purpose: string;
    dispatches_used: number;
    blocks_duplicate: boolean;
    deadline_at: Date | string;
    created_at: Date | string;
  },
  sessionState: string,
  closure: {
    localClosed: boolean | null;
    acknowledged: boolean;
    proof: boolean;
  },
  now = Date.now(),
) {
  const mutable = sessionState !== 'paused' && sessionState !== 'archived';
  const reason = mutable
    ? 'job_not_resumable'
    : sessionState === 'paused'
      ? 'session_paused'
      : 'session_archived';
  return {
    ...actions(['refresh'], true),
    ...actions(
      ['continue_before_dispatch'],
      mutable &&
        job.state === 'blocked_paused' &&
        job.dispatches_used === 0 &&
        Math.min(
          new Date(job.deadline_at).getTime(),
          new Date(job.created_at).getTime() + 300000,
        ) > now,
      reason,
    ),
    ...actions(
      ['request_new_generation'],
      mutable &&
        ['learning_packet', 'assessment_only'].includes(job.purpose) &&
        ['failed_known', 'unknown'].includes(job.state) &&
        closure.localClosed === true &&
        (job.state !== 'unknown' ||
          (closure.acknowledged && closure.proof && !job.blocks_duplicate)),
      reason,
    ),
  };
}
