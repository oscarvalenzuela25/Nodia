import { describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { CheckModuleAccessUseCase } from '../authorization/use-case/check-module-access.use-case.js';
import { ApiNodiaAiCredentialsService } from '../nodia-ai-adapter/api-nodia-ai-credentials.service.js';
import type { NodiaAiRuntimePolicy } from '../nodia-ai-runtime/config/runtime-policy.js';
import type { TeacherSelection } from '../teacher/types/teacher.types.js';
import type { AiGenerationPort } from './ai-generation-port.js';
import { TeacherAgenticTextService } from './teacher-agentic-text.service.js';
import type { GeminiTeacherTextTransport } from './gemini-teacher-text-transport.js';
import type { TeacherAgenticObservation, TeacherAgenticTransport } from './agentic-text-contract.js';
import { TeacherGenerationRuntimeService } from './teacher-generation-runtime.service.js';
import { codexError } from '../common/ai/codex/codex-contract.js';

const actor = { userId: '7', sessionId: '11111111-1111-4111-8111-111111111111' };
const selection: TeacherSelection = { connection_id: '4', mode: 'agentic', model_id: 'fixture-model', effort_id: 'future_effort' };
const observation = (): TeacherAgenticObservation => ({ contract: 'teacher-agentic-text/1', available: true, reason: null,
  observed_at: '2026-11-14T00:00:00Z', resource_key: `gemini-profile:${'a'.repeat(64)}`, session_generation: 'b'.repeat(32),
  runtime_hash: 'c'.repeat(64), binary_sha512: 'd'.repeat(128), policy_hash: 'e'.repeat(64), tool_policy: 'finish_only', native_io: false });
type QueuedJob = Record<string, unknown> & { id: string; state: string; fence: string; selection_snapshot: TeacherSelection; configuration_generation: string; session_generation: string | null };
type InternalRuntime = { claim(worker: string, onlyId?: string | null, signal?: AbortSignal): Promise<{ config: { sessionGeneration: string | null; agentic?: TeacherAgenticObservation }; job: QueuedJob } | null> };

async function fixture(mode: 'agentic' | 'api_key' = 'agentic') {
  let authorized = true, active = true, inTransaction = false;
  const chosen: TeacherSelection = { ...selection, mode, effort_id: mode === 'api_key' ? 'high' : selection.effort_id };
  const provider = { id: '4', provider_key: 'gemini', is_active: true, use_agentic: true, use_api_key: true,
    catalog_active: true, can_use_agentic: true, can_use_api_key: true,
    fields: { agentic: { selected_model: chosen.model_id, available_models: [{ id: chosen.model_id }, { id: 'fixture-second' }] },
      api_key: { selected_model: chosen.model_id, available_models: [{ id: chosen.model_id }] } },
    updated_at: '2026-11-14T00:00:00Z', key_id: '9', secret_fingerprint: 'f'.repeat(64), key_updated_at: '2026-11-14T00:00:00Z',
    key_active: true, is_selected: true, cooldown_until: null };
  const jobs: QueuedJob[] = [];
  const operations: unknown[][] = [];
  const queries: string[] = [];
  const query = vi.fn(async (sql: string, args: unknown[] = []) => {
    queries.push(sql);
    if (sql.includes('AS "actorId"')) return active ? [{ actorId: actor.userId, sessionId: actor.sessionId, isSuperAdmin: false }] : [];
    if (sql.includes('AS actor_active')) return [{ actor_active: active, allowed: authorized }];
    if (sql.includes('FROM ai_providers')) return [structuredClone(provider)];
    if (sql.startsWith('SELECT j.*,s.owner_user_id')) return jobs.filter(job => job.state === 'queued' && (!args[1] || job.id === args[1])).slice(0, 1).map(job => structuredClone(job));
    if (sql.startsWith('UPDATE teacher_generation_jobs SET state=\'failed_known\'')) {
      const job = jobs.find(item => item.id === args[0]);
      if (job && job.state === 'queued' && job.fence === args[2] && JSON.stringify(job.selection_snapshot) === args[3] && job.configuration_generation === args[4]) job.state = 'failed_known';
      return [];
    }
    if (sql.startsWith("UPDATE teacher_generation_jobs SET state='running'")) {
      const job = jobs.find(item => item.id === args[0])!;
      job.state = 'running'; job.fence = String(args[1]); job.session_generation = args[3] as string | null;
      return [];
    }
    if (sql.includes('SELECT * FROM nodia_ai_runtime_slots')) return [{ state: 'free', fence: '0' }];
    if (sql.startsWith('INSERT INTO ai_generation_operations')) { operations.push(args); return []; }
    if (sql.includes('qualifications')) throw Error('An optional diagnostic was incorrectly required');
    if (/^(SET LOCAL|LOCK TABLE|SELECT pg_advisory|INSERT INTO nodia_ai_runtime_slots|INSERT INTO teacher_generation_attempts|UPDATE nodia_ai_runtime_slots|SELECT id FROM ai_generation_operations)/.test(sql)) return [];
    throw Error(`Unexpected fixture SQL: ${sql}`);
  });
  const manager = { query, queryRunner: { isTransactionActive: false } } as unknown as EntityManager;
  const source = { manager, query, transaction: vi.fn(async (work: (manager: EntityManager) => Promise<unknown>) => {
    inTransaction = true;
    const transactional = { query, queryRunner: { isTransactionActive: true } } as unknown as EntityManager;
    try { return await work(transactional); } finally { inTransaction = false; }
  }) } as unknown as DataSource;
  const native = { observe: vi.fn(async (_chosen: TeacherSelection) => { expect(inTransaction).toBe(false); return observation(); }),
    start: vi.fn(), status: vi.fn(), reconcile: vi.fn(), acknowledge: vi.fn() };
  const agentic = new TeacherAgenticTextService(source, native as unknown as GeminiTeacherTextTransport, native as unknown as TeacherAgenticTransport);
  const credentials = new ApiNodiaAiCredentialsService(source);
  const transport = { execute: vi.fn() };
  const runtime = new TeacherGenerationRuntimeService(source, new CheckModuleAccessUseCase(source), credentials,
    null as never, null as never, transport as unknown as AiGenerationPort, { queue: { foreground_workers: 2 } } as NodiaAiRuntimePolicy, agentic);
  const config = await runtime.verifySelection(manager, actor, chosen, 'contextual_reply');
  function addJob(selected = chosen) {
    const job: QueuedJob = { id: `10000000-0000-4000-8000-${String(jobs.length + 1).padStart(12, '0')}`, session_id: '20000000-0000-4000-8000-000000000001',
      actor_id: actor.userId, auth_session_public_id: actor.sessionId, session_owner_user_id: actor.userId, purpose: 'plan_outline',
      state: 'queued', fence: '0', selection_snapshot: { ...selected }, configuration_generation: config.configuration_generation,
      session_generation: config.session_generation, prompt_snapshot: 'Fixture prompt', deadline_at: new Date(Date.now() + 600000) };
    jobs.push(job); return job;
  }
  const job = addJob();
  return { runtime, internal: runtime as unknown as InternalRuntime, manager, source, native, transport, config, job, jobs, operations, queries, provider, chosen, addJob,
    revoke: () => { authorized = false; }, deactivate: () => { active = false; } };
}

describe('Teacher admission without qualification prerequisites', () => {
  it.each(['agentic', 'api_key'] as const)('accepts explicit %s configuration without a selection or purpose canary', async mode => {
    const f = await fixture(mode);
    expect(f.config.configuration_generation).toMatch(/^[a-f0-9]{64}$/);
    if (mode === 'agentic') expect(f.config.session_generation).toBeNull();
    expect(f.native.observe).not.toHaveBeenCalled();
    expect(f.queries.some(sql => sql.includes('qualifications'))).toBe(false);
    expect(f.transport.execute).not.toHaveBeenCalled();
  });

  it('reports API configuration readiness without fabricating an inference or observation date', async () => {
    const f = await fixture('api_key');
    expect(await f.runtime.eligibility(actor, f.chosen.connection_id, f.chosen)).toEqual({ eligible: true, reason_code: 'configuration_ready', checked_at: null, selection: f.chosen });
    expect(f.native.observe).not.toHaveBeenCalled();
    expect(f.transport.execute).not.toHaveBeenCalled();
  });

  it('observes the current native identity outside SQL and binds it before reserving one operation', async () => {
    const f = await fixture();
    const claim = await f.internal.claim('fixture-worker');
    expect(claim?.config.sessionGeneration).toBe('b'.repeat(32));
    expect(claim?.job.session_generation).toBe('b'.repeat(32));
    expect(f.operations).toHaveLength(1);
    expect(f.native.observe).toHaveBeenCalledExactlyOnceWith(f.chosen, expect.any(String), expect.any(AbortSignal));
    expect(f.transport.execute).not.toHaveBeenCalled();
    expect(f.native.start).not.toHaveBeenCalled();
    expect(f.queries.some(sql => sql.includes('qualifications'))).toBe(false);
  });

  it.each(['configuration', 'module', 'session', 'selection', 'fence', 'job-configuration', 'job-session'] as const)('never reserves or dispatches if %s changes during native observation', async change => {
    const f = await fixture();
    f.native.observe.mockImplementationOnce(async () => {
      if (change === 'configuration') f.provider.updated_at = '2026-11-14T00:00:01Z';
      if (change === 'module') f.revoke();
      if (change === 'session') f.deactivate();
      if (change === 'selection') f.job.selection_snapshot.model_id = 'fixture-second';
      if (change === 'fence') f.job.fence = '1';
      if (change === 'job-configuration') f.job.configuration_generation = 'f'.repeat(64);
      if (change === 'job-session') f.job.session_generation = 'f'.repeat(32);
      return observation();
    });
    expect(await f.internal.claim('fixture-worker')).toBeNull();
    expect(f.operations).toEqual([]);
    expect(f.transport.execute).not.toHaveBeenCalled();
    expect(f.native.start).not.toHaveBeenCalled();
    if (['selection', 'fence', 'job-configuration', 'job-session'].includes(change)) expect(f.job.state).toBe('queued');
  });

  it('does not reuse one job observation for a second selection or claim an already running job', async () => {
    const f = await fixture();
    expect(await f.internal.claim('worker-one')).not.toBeNull();
    expect(await f.internal.claim('worker-two')).toBeNull();
    const next = { ...f.chosen, model_id: 'fixture-second', effort_id: 'another_effort' };
    f.addJob(next);
    expect(await f.internal.claim('worker-two')).not.toBeNull();
    expect(f.native.observe.mock.calls.map(call => call[0])).toEqual([f.chosen, next]);
    expect(f.operations).toHaveLength(2);
    expect(f.transport.execute).not.toHaveBeenCalled();
  });

  it('preserves queued work without a dispatch when worker observation is canceled', async () => {
    const f = await fixture(); const cancellation = new AbortController();
    f.native.observe.mockImplementationOnce(async () => { cancellation.abort(); cancellation.signal.throwIfAborted(); return observation(); });
    expect(await f.internal.claim('worker', null, cancellation.signal)).toBeNull();
    expect(f.job.state).toBe('queued');
    expect(f.operations).toEqual([]);
  });

  it('keeps contention queued rather than treating another profile owner as failed authentication', async () => {
    const f = await fixture();
    f.native.observe.mockRejectedValueOnce(codexError('codex_profile_busy', 409));
    expect(await f.internal.claim('worker')).toBeNull();
    expect(f.job.state).toBe('queued');
    expect(f.operations).toEqual([]);
  });

  it('does not replace a historical bound native epoch with a different current session', async () => {
    const f = await fixture(); f.job.session_generation = 'f'.repeat(32);
    expect(await f.internal.claim('worker')).toBeNull();
    expect(f.job.state).toBe('failed_known');
    expect(f.operations).toEqual([]);
  });
});
