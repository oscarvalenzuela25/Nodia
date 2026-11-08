import { describe, expect, it } from 'vitest';
import { sessionListPollInterval } from '../../../../modules/teacher/infrastructure/sessionList';
import { sessionsSchema } from '../../../../modules/teacher/infrastructure/schemas';

const row = { id: 'fixture-session', title: null, topic: 'Fixture', objective: 'Learn fixture', state: 'paused', revision: 1, updated_at: '2026-11-06T00:00:00Z' };
const page = (state?: string) => ({ data: [{ ...row, latest_job: state ? { job_id: 'fixture-job', state, purpose: 'plan_outline' } : null }], meta: { page: 1, limit: 10, total_items: 1, total_pages: 1 } });

describe('Teacher session background status', () => {
  it.each(['queued', 'running'])('polls confirmed %s only while visible', state => {
    expect(sessionListPollInterval(page(state), true)).toBe(5000);
    expect(sessionListPollInterval(page(state), false)).toBe(false);
  });
  it.each(['blocked_paused', 'unknown', 'ready', 'failed_known', 'cancelled_before_dispatch'])('never treats %s as active generation', state => {
    expect(sessionListPollInterval(page(state), true)).toBe(false);
    expect(sessionsSchema.parse(page(state)).data[0].state).toBe('paused');
  });
  it('retains unknown absence for old responses and never manufactures an active job', () => {
    for (const value of [page(), { ...page(), data: [row] }, { ...page(), data: [] }, undefined]) expect(sessionListPollInterval(value, true)).toBe(false);
    expect(sessionsSchema.parse({ ...page(), data: [row] }).data[0].latest_job).toBeUndefined();
  });
  it('rejects malformed job states and purposes and stops polling invalid responses', () => {
    for (const value of [page('invented'), { ...page(), data: [{ ...row, latest_job: { job_id: 'fixture-job', state: 'queued', purpose: 'invented' } }] }]) {
      expect(sessionsSchema.safeParse(value).success).toBe(false);
      expect(sessionListPollInterval(value, true)).toBe(false);
    }
  });
});
