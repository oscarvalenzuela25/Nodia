import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { vi } from 'vitest';
import { confirmationFixture } from '../../src/nodia-ai-confirmation/use-case/confirmation.fixture.js';
import { NodiaAiExecutionStep } from '../../src/nodia-ai-confirmation/entities/nodia-ai-execution-step.entity.js';
import { NodiaAiJob } from '../../src/nodia-ai-runtime/entities/nodia-ai-job.entity.js';
import { NodiaAiExecutionGrant } from '../../src/nodia-ai-runtime/entities/nodia-ai-execution-grant.entity.js';
import type { EntityManager } from 'typeorm';
import type {
  SecureFlowKind,
  SecureFlowDescriptor,
} from '../../src/nodia-ai-secure-flow/types/secure-flow.types.js';
import type { NodiaAiExecutionClaim } from '../../src/nodia-ai-execution/types/execution-claim.types.js';
import type { AiProviderSecureObservation } from '../../src/ai-provider/use-case/manage-ai-provider-secure-session.use-case.js';

const tools: Record<SecureFlowKind, string> = {
  api_key_create: 'nodia_secure_flows_prepare_api_key_create',
  api_key_update: 'nodia_secure_flows_prepare_api_key_update',
  api_key_delete: 'nodia_api_keys_prepare_delete',
  connection_login: 'nodia_secure_flows_prepare_connection_login',
  nodia_logout: 'nodia_secure_flows_prepare_nodia_logout',
  codex_logout: 'nodia_ai_providers_prepare_codex_logout',
  gemini_web_logout: 'nodia_ai_providers_prepare_gemini_web_logout',
  sync_models: 'nodia_ai_providers_prepare_sync_models',
};
export function secureFlowFixture(kind: SecureFlowKind = 'api_key_create') {
  const f = confirmationFixture(),
    identity = { userId: f.actor.actorId, sessionId: f.actor.sessionId },
    flowId = randomUUID();
  const source = {
    ...f.step,
    tool_name: tools[kind],
    scope: {},
    preconditions: { provider_key: 'gemini' },
    command_template: {
      schema_version: 1,
      provider_id: '31',
      ...(kind === 'api_key_update' || kind === 'api_key_delete'
        ? { key_id: '41' }
        : {}),
      mode: 'token_plan_agentic',
      command: kind === 'api_key_create' ? { label: 'Synthetic key' } : {},
    },
  };
  f.loaded.steps = [source];
  f.loaded.context.manager = f.manager;
  f.loaded.revision.state = 'confirmed';
  f.loaded.chat.owner_id = identity.userId;
  Object.assign(f.loaded.chat, { lifecycle: 'active' });
  const descriptor: SecureFlowDescriptor = {
    schema_version: 1,
    kind: 'secure_human_flow',
    reference: flowId,
    flow_kind: kind,
    actor_id: identity.userId,
    session_id: identity.sessionId,
    expires_at: new Date(f.now.getTime() + 300000).toISOString(),
    status: 'waiting',
    native_reference: null,
    request_id: null,
    request_action: null,
    request_revision: null,
  };
  const execution = Object.assign(f.execution, {
    state: 'waiting_for_user',
    revision: 3,
  });
  const step = Object.assign(new NodiaAiExecutionStep(), {
    id: source.id,
    execution_id: execution.id,
    source_step_id: source.id,
    position: 1,
    tool_name: source.tool_name,
    template_hash: f.validate.hash({
      command_template: source.command_template,
      output_bindings: [],
      preconditions: source.preconditions,
    }),
    bound_command_hash: 'b'.repeat(64),
    bound_command: null,
    native_request_key: randomUUID(),
    state: 'waiting_for_user',
    minimal_scope: {},
    minimal_receipt: null,
    recovery_descriptor: descriptor,
    lease_fence: '1',
    error_code: null,
    dispatched_at: null,
    completed_at: null,
  });
  const job = Object.assign(new NodiaAiJob(), {
    id: randomUUID(),
    kind: 'execution',
    execution_id: execution.id,
    conversation_id: f.chat.id,
    run_id: null,
    state: 'waiting',
    lease_owner: null,
    lease_until: null,
    fence: '1',
    attempt_count: 1,
    deadline_at: new Date(f.now.getTime() + 600000),
    available_at: f.now,
    updated_at: f.now,
    stage_key: 'execution_step',
    stage_seq: 1,
  });
  f.loaded.chat.active_job_id = job.id;
  const grant = Object.assign(new NodiaAiExecutionGrant(), {
    id: randomUUID(),
    actor_id: identity.userId,
    session_public_id: identity.sessionId,
    execution_id: execution.id,
    run_id: null,
    command_set_hash: execution.proposal_hash,
    allowed_modules: ['/settings/ai-providers'],
    allowed_operations: [source.tool_name],
    allowed_scope: execution.minimal_scope,
    policy_version: f.policy.policyVersion,
    expires_at: job.deadline_at,
    revoked_at: null,
  });
  const saved: unknown[] = [];
  let active = false;
  const repo = {
    save: vi.fn(async (value: unknown) => {
      saved.push(structuredClone(value));
      return value;
    }),
    update: vi.fn(async () => ({ affected: 1 })),
  };
  f.manager.getRepository = vi.fn(
    () => repo,
  ) as unknown as EntityManager['getRepository'];
  const store = {
    transaction: vi.fn(
      async <T>(work: (manager: EntityManager) => Promise<T>) => {
        active = true;
        try {
          return await work(f.manager);
        } finally {
          active = false;
        }
      },
    ),
    execution: vi.fn(async () => execution),
    steps: vi.fn(async () => [step]),
    jobs: vi.fn(async () => [job]),
    grants: vi.fn(async () => [grant]),
    chat: vi.fn(async () => f.loaded.chat),
    now: vi.fn(async () => f.now),
    confirmedBySession: vi.fn(async () => true),
  };
  const port = {
    moduleRoutes: ['/settings/ai-providers'],
    verifyPreconditions: vi.fn(async () => {}),
  };
  const proposals = { preparer: vi.fn(() => port), equal: isDeepStrictEqual };
  const status = {
    authorize: vi.fn(
      async (_manager: EntityManager, actor: typeof identity) => ({
        ...f.loaded,
        execution,
        actor: {
          ...f.actor,
          actorId: actor.userId,
          sessionId: actor.sessionId,
        },
      }),
    ),
    project: vi.fn(async () => ({})),
  };
  const observation: AiProviderSecureObservation = {
    reference: {
      provider_id: '31',
      provider_key: 'gemini',
      mode: 'token_plan_agentic',
      job_id: 'a'.repeat(32),
    },
    state: 'pending',
    human: {
      kind: 'gemini_agentic',
      data: {
        id: 'a'.repeat(32),
        state: 'waiting_code',
        authorization_url: 'https://accounts.google.com/synthetic-only',
      },
    },
  };
  const native = {
    start: vi.fn(async () => {
      if (active) throw new Error('network_inside_sql');
      return structuredClone(observation);
    }),
    status: vi.fn(async () => structuredClone(observation)),
    observeRequest: vi.fn(async () => {
      if (active) throw new Error('network_inside_sql');
      return structuredClone(observation);
    }),
    cancelRequest: vi.fn(async () => {
      if (active) throw new Error('network_inside_sql');
      return { ...structuredClone(observation), state: 'cancelled' as const };
    }),
    acknowledgeRequest: vi.fn(async () => {
      if (active) throw new Error('network_inside_sql');
    }),
    submitCode: vi.fn(async () => structuredClone(observation)),
    input: vi.fn(async () => structuredClone(observation)),
    cancel: vi.fn(async () => ({
      ...structuredClone(observation),
      state: 'cancelled' as const,
    })),
    frame: vi.fn(async () => ({ imageBase64: 'synthetic' })),
    logout: vi.fn(async () => ({ disconnected: true })),
    discover: vi.fn(async () => ({
      providerId: '31',
      models: [{ id: 'discovered-dynamically' }],
    })),
    commitDiscovery: vi.fn(async () => {}),
    cleanup: vi.fn(async () => ({
      ...structuredClone(observation),
      state: 'cancelled' as const,
    })),
  };
  const keys = {
      execute: vi.fn(async () => ({ id: '41' })),
      remove: vi.fn(async () => {}),
    },
    revoke = { execute: vi.fn(async () => {}) };
  const claim: NodiaAiExecutionClaim = {
    executionId: execution.id,
    identity,
    jobId: job.id,
    attemptId: randomUUID(),
    workerId: randomUUID(),
    fence: '1',
    toolName: source.tool_name,
  };
  return {
    ...f,
    identity,
    flowId,
    source,
    execution,
    step,
    job,
    grant,
    descriptor,
    store,
    proposals,
    port,
    status,
    native,
    keys,
    revoke,
    repo,
    saved,
    claim,
    isActive: () => active,
    request: (payload?: Record<string, string>) => ({
      expected_execution_revision: execution.revision,
      client_request_id: randomUUID(),
      ...(payload ? { payload } : {}),
    }),
  };
}
