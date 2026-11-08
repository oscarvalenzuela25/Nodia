import { describe, expect, it } from 'vitest';
import { RecoverNodiaAiJobsUseCase } from './recover-nodia-ai-jobs.use-case.js';
import { runtimeFixture } from './runtime.fixture.js';
import { runtimeProofDescriptor } from './runtime-reconciliation-descriptor.js';

describe('RecoverNodiaAiJobsUseCase observation', () => {
  it.each([
    { phase: 'claimed', state: 'cancelled', mode: 'agentic' as const },
    { phase: 'claimed', state: 'cancelled', mode: 'api_key' as const },
    { phase: 'dispatch_armed', state: 'unknown', mode: 'agentic' as const },
    { phase: 'dispatch_armed', state: 'unknown', mode: 'api_key' as const },
  ])(
    'materializes $state for $mode without pretending cancellation reversed an armed dispatch',
    async ({ phase, state, mode }) => {
      const f = runtimeFixture();
      f.leased();
      f.run.state = 'cancel_requested';
      f.run.selection_snapshot.mode = mode;
      if (mode === 'api_key')
        f.job.recovery_descriptor = runtimeProofDescriptor({
          engine: 'api_key',
          attemptId: f.attempt.id,
          operationRef: f.attempt.id,
          resourceKey: 'api-connection:' + 'a'.repeat(64),
          sessionGeneration: 'b'.repeat(32),
          adapterIdentity: {
            providerKey: 'openai',
            contractVersion: 'nodia-ai-api-chat/1',
            connectionId: '1',
          },
        });
      const originalDescriptor = JSON.stringify(f.job.recovery_descriptor);
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
      expect(JSON.stringify(f.job.recovery_descriptor)).toBe(
        originalDescriptor,
      );
      if (mode === 'api_key' && phase === 'dispatch_armed')
        expect(
          f.query.mock.calls.some(([sql]) =>
            sql.includes("runtime_slots SET state='unknown'"),
          ),
        ).toBe(true);
    },
  );
});
