import type { EntityManager } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { latestSessionJobs } from './teacher-session-jobs.js';

describe('Teacher session list latest jobs', () => {
  it('reads one bounded batch for authorized page IDs and projects only public job fields', async () => {
    const query = vi.fn().mockResolvedValue([
      { session_id: 'owned-a', job_id: 'latest-a', state: 'running', purpose: 'plan_outline', prompt_snapshot: 'private fixture' },
      { session_id: 'other-owner', job_id: 'private-job', state: 'ready', purpose: 'setup_reply' },
      { session_id: 'owned-b', job_id: 'latest-b', state: 'unknown', purpose: 'learning_packet', selection_snapshot: {} },
    ]);
    const result = await latestSessionJobs({ query } as unknown as EntityManager, ['owned-a', 'owned-b', 'owned-no-job']);
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0][1]).toEqual([['owned-a', 'owned-b', 'owned-no-job']]);
    expect(query.mock.calls[0][0]).toContain('WHERE session_id=ANY($1::uuid[])');
    expect(query.mock.calls[0][0]).toContain("ORDER BY session_id,(state IN ('queued','running')) DESC,created_at DESC,id DESC");
    expect([...result]).toEqual([
      ['owned-a', { job_id: 'latest-a', state: 'running', purpose: 'plan_outline' }],
      ['owned-b', { job_id: 'latest-b', state: 'unknown', purpose: 'learning_packet' }],
    ]);
    expect(result.get('owned-no-job') ?? null).toBeNull();
  });
  it('does not query for an empty page or permit an unbounded page', async () => {
    const query = vi.fn().mockResolvedValue([]);
    expect(await latestSessionJobs({ query } as unknown as EntityManager, [])).toEqual(new Map());
    await expect(latestSessionJobs({ query } as unknown as EntityManager, Array.from({ length: 51 }, (_, i) => String(i)))).rejects.toThrow('teacher_session_page_exceeds_limit');
    expect(query).not.toHaveBeenCalled();
    expect(await latestSessionJobs({ query } as unknown as EntityManager, Array.from({ length: 50 }, (_, i) => String(i)))).toEqual(new Map());
    expect(query).toHaveBeenCalledOnce();
  });
});
