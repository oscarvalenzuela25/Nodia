import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { NodiaAiConversation } from '../../nodia-ai-conversation/entities/nodia-ai-conversation.entity.js';
import { NodiaAiRun } from '../../nodia-ai-run/entities/nodia-ai-run.entity.js';
import { NodiaAiJob } from '../entities/nodia-ai-job.entity.js';
import { NodiaAiJobAttempt } from '../entities/nodia-ai-job-attempt.entity.js';
import { NodiaAiExecutionGrant } from '../entities/nodia-ai-execution-grant.entity.js';
import { ValidateNodiaAiRuntimePolicyUseCase } from './validate-nodia-ai-runtime-policy.use-case.js';
import type { NodiaAiRuntimeService } from '../nodia-ai-runtime.service.js';
import type { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { NodiaAiClaim } from '../types/worker.types.js';
import { eventJournalFixture } from '../../nodia-ai-run/event-journal.fixture.js';

export function policyEnvelope() {
  const bytes = readFileSync(
    new URL(
      '../../../../docs/mvp/nodia-ai-v1-runtime-policy.json',
      import.meta.url,
    ),
  );
  const policy: unknown = JSON.parse(bytes.toString('utf8'));
  const schema: unknown = JSON.parse(
    readFileSync(
      new URL(
        '../../../../docs/mvp/nodia-ai-v1-runtime-policy.schema.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const payload = {
    schema_version: 1,
    policyHash: createHash('sha256').update(bytes).digest('hex'),
    policy,
    schema,
  };
  return {
    ...payload,
    contentHash: createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex'),
  };
}
export function runtimeFixture() {
  const policy = new ValidateNodiaAiRuntimePolicyUseCase().execute(
    policyEnvelope(),
  );
  const now = new Date('2026-10-15T18:00:00.000Z');
  const future = new Date(now.getTime() + 600000);
  const userId = '1';
  const sessionId = 'd69a723c-5e43-4dac-912f-3494970a37a2';
  const workerId = '66559df7-2264-4c3c-a3bf-601b66b3b909';
  const conversation: NodiaAiConversation = Object.assign(
    new NodiaAiConversation(),
    {
      id: '326a38de-e042-4b40-8305-b10239dde721',
      owner_id: userId,
      active_job_id: 'a375f7fd-1a1e-4924-807c-e9d19f000688',
      retention_epoch: '1',
      expires_at: future,
      lifecycle: 'active',
      routing_enabled: false,
      routing_revision: 1,
    },
  );
  const run: NodiaAiRun = Object.assign(new NodiaAiRun(), {
    id: 'e42c1020-9d88-4b46-9517-c73727a50c05',
    conversation_id: conversation.id,
    actor_id: userId,
    selection_snapshot: {
      connection_id: '1',
      mode: 'token_plan_web' as const,
      model_id: 'fixture-model',
      effort_id: null,
    },
    catalog_version: 'fixture-release',
    policy_version: policy.policyVersion,
    policy_hash: policy.policyHash,
    retention_epoch: '1',
    state: 'queued',
    revision: 1,
    error_code: null,
    context_manifest: {},
    deadline_at: future,
    routing_snapshot: {
      schema_version: 1 as const,
      enabled: false,
      revision: 1,
      target: null,
    },
    budget_snapshot: {
      schema_version: 1 as const,
      tool_calls: 12,
      mcp_rpc_messages: 128,
      provider_dispatches: 3,
      compactions: 1,
      delegations: 1,
    },
  });
  const job: NodiaAiJob = Object.assign(new NodiaAiJob(), {
    id: conversation.active_job_id,
    kind: 'turn',
    conversation_id: conversation.id,
    run_id: run.id,
    state: 'ready',
    fence: '0',
    attempt_count: 0,
    stage_key: 'context',
    stage_seq: 1,
    deadline_at: future,
    available_at: now,
    lease_owner: null,
    lease_until: null,
  });
  const grant: NodiaAiExecutionGrant = Object.assign(
    new NodiaAiExecutionGrant(),
    {
      id: '9a3ef6fc-9362-4672-bbe8-85609c629d2b',
      actor_id: userId,
      session_public_id: sessionId,
      run_id: run.id,
      allowed_modules: [],
      allowed_operations: ['chat:respond'],
      policy_version: policy.policyVersion,
      expires_at: future,
      revoked_at: null,
    },
  );
  const journal = eventJournalFixture(run);
  const query = vi.fn(
    async (sql: string, _args?: unknown[]): Promise<unknown[]> => {
      const eventResult = journal.query(sql, _args);
      if (eventResult !== undefined) return eventResult;
      if (sql.startsWith('UPDATE nodia_ai_runs SET state=$2')) {
        run.state = String(_args?.[1]);
        if (sql.includes('error_code=$3'))
          run.error_code = _args?.[2] as string | null;
        if (sql.includes('error_code=$4'))
          run.error_code = _args?.[3] as string | null;
      }
      if (sql.startsWith("UPDATE nodia_ai_runs SET state='failed'")) {
        run.state = 'failed';
        run.error_code = _args?.[1] as string | null;
      }
      if (sql.startsWith("UPDATE nodia_ai_runs SET state='queued'"))
        run.state = 'queued';
      if (
        sql.includes('provider_dispatches_used=') ||
        sql.includes('delegations_used=')
      )
        return [{ id: run.id }];
      if (sql.includes('SELECT resource_key FROM nodia_ai_runtime_slots'))
        return [{ resource_key: 'fixture-profile' }];
      return [];
    },
  );
  const repository = {
    save: vi.fn(async (value: unknown) => value),
    insert: vi.fn(async () => ({ identifiers: [] })),
  };
  const manager = {
    query,
    getRepository: vi.fn(() => repository),
  } as unknown as EntityManager;
  const attempt: NodiaAiJobAttempt = Object.assign(new NodiaAiJobAttempt(), {
    id: '8e687984-ebbd-46cd-977c-279207164d69',
    job_id: job.id,
    attempt_no: 1,
    fence: '1',
    worker_id: workerId,
    phase: 'claimed',
    stage_key: 'context',
    stage_seq: 1,
  });
  const runtime = {
    transaction: vi.fn(async (work: (m: EntityManager) => Promise<unknown>) =>
      work(manager),
    ),
    candidate: vi.fn(async () => conversation.id),
    lockConversation: vi.fn(async () => conversation),
    lockJob: vi.fn(async () => job),
    findRun: vi.fn(async () => run),
    findRunGrant: vi.fn(async () => grant),
    now: vi.fn(async () => now),
    findAttempt: vi.fn(async () => attempt),
  };
  const authorize = {
    execute: vi.fn(async () => ({
      actorId: userId,
      sessionId,
      isSuperAdmin: false,
      modules: [],
    })),
  };
  function leased(): NodiaAiClaim {
    run.state = 'running';
    job.state = 'leased';
    job.fence = '1';
    job.lease_owner = workerId;
    job.lease_until = new Date(now.getTime() + 30000);
    return {
      job: { ...job },
      attempt,
      run: { ...run },
      identity: { userId, sessionId },
    };
  }
  return {
    policy,
    now,
    future,
    workerId,
    conversation,
    job,
    run,
    grant,
    attempt,
    manager,
    query,
    journal,
    repository,
    runtime,
    runtimePort: runtime as unknown as NodiaAiRuntimeService,
    authorize,
    authorization: authorize as unknown as AuthorizeNodiaAiUseCase,
    leased,
  };
}
