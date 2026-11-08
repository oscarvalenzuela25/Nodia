import type { z } from 'zod';
import { sessionsSchema, type sessionListJobSchema } from './schemas';

type ListJob = z.infer<typeof sessionListJobSchema>;
export const SESSION_JOB_COLORS = {
  queued: 'info', running: 'info', blocked_paused: 'warning', unknown: 'warning',
  ready: 'success', failed_known: 'error', cancelled_before_dispatch: 'default',
} as const satisfies Record<ListJob['state'], string>;

/** Local GET cadence, unrelated to estimated generation time or provider capabilities. */
export function sessionListPollInterval(data: unknown, visible: boolean): number | false {
  if (!visible) return false;
  const parsed = sessionsSchema.safeParse(data);
  return parsed.success && parsed.data.data.some(session => session.latest_job?.state === 'queued' || session.latest_job?.state === 'running') ? 5000 : false;
}
