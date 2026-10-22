import { describe, expect, it } from 'vitest';
import { CheckpointNodiaAiJobUseCase } from './checkpoint-nodia-ai-job.use-case.js';
import { RetryNodiaAiJobUseCase } from './retry-nodia-ai-job.use-case.js';
import { runtimeFixture } from './runtime.fixture.js';

function setup(deliveries: number, phase = 'claimed', fits = true) {
  const f = runtimeFixture();
  const claim = f.leased();
  const original = f.query.getMockImplementation()!;
  f.query.mockImplementation(async (sql, args) => sql.startsWith('SELECT a.phase,')
    ? [{ phase, deliveries, fits }]
    : original(sql, args));
  const checkpoint = new CheckpointNodiaAiJobUseCase(f.runtimePort, f.authorization, f.policy);
  return { ...f, claim, subject: new RetryNodiaAiJobUseCase(checkpoint, f.policy) };
}

describe('RetryNodiaAiJobUseCase', () => {
  it.each([[1, 1], [2, 3]])('schedules delivery %s with the existing %ss delay without changing identity, fence, deadline or dispatch budget', async (deliveries, delay) => {
    const f = setup(deliveries);
    const before = structuredClone({ jobId: f.job.id, runId: f.run.id, fence: f.job.fence,
      deadline: f.job.deadline_at, runDeadline: f.run.deadline_at, selection: f.run.selection_snapshot,
      budgets: f.run.budget_snapshot, stage: f.job.stage_key, sequence: f.job.stage_seq });
    await expect(f.subject.execute(f.claim, 'nodia_ai:agentic_observation_timeout')).resolves.toBe(true);
    expect(f.query).toHaveBeenCalledWith(expect.stringContaining("SET state='ready',lease_owner=NULL"), [f.job.id, delay]);
    expect(f.query).toHaveBeenCalledWith(expect.stringContaining("SET phase='failed'"), [f.attempt.id, 'nodia_ai:agentic_observation_timeout']);
    expect({ jobId: f.job.id, runId: f.run.id, fence: f.job.fence, deadline: f.job.deadline_at,
      runDeadline: f.run.deadline_at, selection: f.run.selection_snapshot, budgets: f.run.budget_snapshot,
      stage: f.job.stage_key, sequence: f.job.stage_seq }).toEqual(before);
    expect(f.query.mock.calls.some(([sql]) => sql.includes('provider_dispatches_used=') ||
      sql.includes('INSERT INTO nodia_ai_runtime_slots') || sql.includes("phase='dispatched'"))).toBe(false);
  });
  it.each([[3, 'claimed', true], [1, 'dispatched', true], [1, 'unknown', true], [1, 'claimed', false]] as const)(
    'does not schedule exhausted, armed, uncertain or out-of-time delivery %s/%s/%s', async (deliveries, phase, fits) => {
      const f = setup(deliveries, phase, fits);
      await expect(f.subject.execute(f.claim, 'nodia_ai:agentic_observation_timeout')).resolves.toBe(false);
      expect(f.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE '))).toBe(false);
    },
  );
  it.each(['fence', 'deadline', 'revoked'] as const)('rejects %s changes through the real checkpoint before scheduling', async (change) => {
    const f = setup(1);
    if (change === 'fence') f.job.fence = 'changed';
    if (change === 'deadline') f.job.deadline_at = new Date(f.now);
    if (change === 'revoked') f.grant.revoked_at = new Date(f.now);
    await expect(f.subject.execute(f.claim, 'nodia_ai:agentic_observation_timeout')).rejects.toThrow();
    expect(f.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE '))).toBe(false);
  });
});
