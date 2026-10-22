import { describe, expect, it } from 'vitest';
import { RecoverNodiaAiJobsUseCase } from './recover-nodia-ai-jobs.use-case.js';
import { runtimeFixture } from './runtime.fixture.js';

describe('RecoverNodiaAiJobsUseCase observation', () => {
  it.each([
    { phase: 'claimed', state: 'cancelled' },
    { phase: 'dispatch_armed', state: 'unknown' },
  ])(
    'materializes $state without pretending cancellation reversed an armed dispatch',
    async ({ phase, state }) => {
      const f = runtimeFixture();
      f.leased();
      f.run.state = 'cancel_requested';
      const original = f.query.getMockImplementation()!;
      f.query.mockImplementation(async (sql, args) => {
        if (sql.includes('SELECT c.id,j.id AS job_id'))
          return [{ id: f.conversation.id, job_id: f.job.id }];
        if (sql.startsWith('SELECT id,phase FROM nodia_ai_job_attempts'))
          return [{ id: f.attempt.id, phase }];
        return original(sql, args);
      });
      expect(
        await new RecoverNodiaAiJobsUseCase(f.runtimePort, f.policy).execute(),
      ).toBe(1);
      expect(f.journal.events).toHaveLength(1);
      expect(f.journal.events[0].public_payload).toMatchObject({
        kind: 'run_changed',
        payload: {
          revision: 2,
          state,
          error: {
            retry_action: state === 'unknown' ? 'recover_status' : 'none',
          },
        },
      });
      expect(
        f.query.mock.calls.some(([sql]) =>
          sql.includes("runtime_slots SET state='free'"),
        ),
      ).toBe(phase === 'claimed');
    },
  );
});
