import type { ManageNodiaAiAttachmentUseCase } from '../../nodia-ai-attachment/use-case/manage-nodia-ai-attachment.use-case.js';
import type { NodiaAiPreferenceReaderUseCase } from '../../nodia-ai-preference/use-case/nodia-ai-preference-reader.use-case.js';
import type { NodiaAiContextPreference } from '../../nodia-ai-preference/types/preference.types.js';
import type { ExecuteNodiaAiToolUseCase } from '../../nodia-ai-tools/use-case/execute-nodia-ai-tool.use-case.js';
import type { NodiaAiToolSelectionFlowUseCase } from '../../nodia-ai-tools/use-case/nodia-ai-tool-selection-flow.use-case.js';
import type { CleanupNodiaAiRuntimeProofsUseCase } from '../../nodia-ai-runtime/use-case/cleanup-nodia-ai-runtime-proofs.use-case.js';
import { NodiaAiJobAttempt } from '../../nodia-ai-runtime/entities/nodia-ai-job-attempt.entity.js';
import { NodiaAiKnownPreDispatchError } from '../../nodia-ai-runtime/types/worker.types.js';
import { NODIA_AI_KNOWLEDGE_TOOLS } from './execute-nodia-ai-knowledge-tool.use-case.js';
import { eventJournalFixture } from '../../nodia-ai-run/event-journal.fixture.js';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { EntityManager } from 'typeorm';
import { ProcessNodiaAiStageUseCase } from './process-nodia-ai-stage.use-case.js';
import { BuildNodiaAiContextUseCase, isNodiaAiScopeVisible, type ContextHistoryItem } from './build-nodia-ai-context.use-case.js';
import { BuildNodiaAiCompactionUseCase } from './build-nodia-ai-compaction.use-case.js';
import type { NodiaAiContextSnapshotService } from '../../nodia-ai-context-snapshot/nodia-ai-context-snapshot.service.js';
import type { LoadNodiaAiContextHistoryUseCase } from '../../nodia-ai-context-snapshot/use-case/load-nodia-ai-context-history.use-case.js';
import type { LoadNodiaAiRecoveryRefsUseCase } from './load-nodia-ai-recovery-refs.use-case.js';
import { NODIA_AI_COMPACTION_BUILDER_VERSION, type NodiaAiCompactionSummary } from '../types/nodia-ai-compaction.types.js';
import type { LoadNodiaAiKnowledgeUseCase } from './load-nodia-ai-knowledge.use-case.js';
import type { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { NodiaAiAdapterPort, NodiaAiAdapterRequest } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import type { ReserveNodiaAiRuntimeSlotUseCase } from '../../nodia-ai-runtime/use-case/reserve-nodia-ai-runtime-slot.use-case.js';
import type { ReleaseNodiaAiRuntimeSlotUseCase } from '../../nodia-ai-runtime/use-case/release-nodia-ai-runtime-slot.use-case.js';
import type { NodiaAiRuntimePolicy } from '../../nodia-ai-runtime/config/runtime-policy.js';
import type {
  NodiaAiClaim,
  NodiaAiStageContext,
} from '../../nodia-ai-runtime/types/worker.types.js';

function fixture(
  stage = 'inference',
  attachments?: ManageNodiaAiAttachmentUseCase,
) {
  const policy = JSON.parse(
    readFileSync(
      new URL(
        '../../../../docs/mvp/nodia-ai-v1-runtime-policy.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as NodiaAiRuntimePolicy;
  const events: string[] = [];
  const modules = ['/finance', '/tools/nodia-ai'];
  const sourceScope = { schema_version: 1, module_routes: modules };
  const observation = {
    supportsMcp: false,
    available: true,
    resourceKey: 'gemini-profile:' + '1'.repeat(64),
    configurationGeneration: '2'.repeat(64),
    sessionGeneration: '3'.repeat(32),
  };
  const claim = {
    job: { stage_key: stage },
    attempt: { id: 'attempt' },
    identity: { userId: '1', sessionId: 'session' },
    run: {
      id: 'run',
      conversation_id: 'chat',
      input_through_seq: '2',
      deadline_at: new Date(Date.now() + 60000),
      selection_snapshot: {
        connection_id: '2',
        mode: 'token_plan_web',
        model_id: 'fixture-model',
        effort_id: null,
      },
      context_manifest: {
        schema_version: 1,
        knowledge_release: 'release',
        resource_key: observation.resourceKey,
        configuration_generation: observation.configurationGeneration,
        session_generation: observation.sessionGeneration,
        module_routes: modules,
      },
    },
  } as unknown as NodiaAiClaim;
  const knowledge = {
    manifest: { release_id: 'release', catalog_release: 'catalog' },
    index: vi.fn().mockReturnValue([]),
    execute: vi.fn().mockReturnValue({
      releaseId: 'release',
      catalogVersion: 'catalog',
      fragments: [],
    }),
  };
  const actor = { modules: modules.map((route) => ({ route })) };
  const authorize = { execute: vi.fn().mockResolvedValue(actor) };
  const journal = eventJournalFixture();
  const query = vi
    .fn()
    .mockImplementation(async (sql: string, parameters?: unknown[]) => {
      const eventResult = journal.query(sql, parameters);
      if (eventResult !== undefined) return eventResult;
      if (sql.includes('count(DISTINCT')) return [{ total: '2', bytes: '10' }];
      if (sql.startsWith('SELECT id,seq::text'))
        return [
          {
            id: 'own',
            seq: '1',
            role: 'user',
            author_id: '1',
            source_scope_manifest: sourceScope,
          },
          {
            id: 'foreign',
            seq: '2',
            role: 'user',
            author_id: '2',
            source_scope_manifest: sourceScope,
          },
        ];
      if (sql.startsWith('SELECT message_id,kind,text'))
        return [
          { message_id: 'own', kind: 'text', text: 'Consulta sintética' },
        ];
      if (sql.includes('chat_bytes'))
        return [{ chat_bytes: '0', owner_bytes: '0' }];
      if (sql.startsWith('WITH changed AS (UPDATE nodia_ai_conversations'))
        return [{ seq: '3' }];
      if (sql.startsWith('WITH changed AS (UPDATE nodia_ai_runs SET compactions_used=')) return [{ id: claim.run.id }];
      if (sql.startsWith('SELECT (') && sql.endsWith(' AS bytes')) return [{ bytes: String(
        (typeof parameters?.[0] === 'number' ? parameters[0] * 2 : Buffer.byteLength(JSON.stringify(parameters?.[0]))) +
        Buffer.byteLength(JSON.stringify(parameters?.[1])),
      ) }];
      return [];
    });
  const runRepository = {
    findOneByOrFail: vi.fn().mockResolvedValue(claim.run),
    save: vi.fn().mockResolvedValue(claim.run),
  };
  const manager = {
    query,
    getRepository: vi.fn().mockReturnValue(runRepository),
  } as unknown as EntityManager;
  const proof = {
    engine: 'web' as const,
    attemptId: 'attempt',
    resourceKey: observation.resourceKey,
    sessionGeneration: observation.sessionGeneration,
    operationRef: 'attempt',
    terminalProofId: '8d524fcc-68dd-4c62-a183-6cf3baedc6d1',
    processClosed: true as const,
    outcome: 'completed' as const,
    observedAt: new Date(),
  };
  const adapter = {
    measureContext: vi.fn().mockImplementation(async (input: {canonicalPrompt:string}) => ({
      measurementContractVersion: 'nodia-ai-context-budget/1', measurementScope: 'initial_native_prompt',
      measurementKind: 'exact', canonicalUtf8Bytes: Buffer.byteLength(input.canonicalPrompt),
      catalogUtf8Bytes: 0, overheadUtf8Bytes: 128, totalUtf8Bytes: Buffer.byteLength(input.canonicalPrompt) + 128,
      firstMcpListingUpperBoundUtf8Bytes: 0,
      maxUtf8Bytes: 262144, modelContextTokens: null,
    })),
    observe: vi.fn().mockImplementation(async () => {
      events.push('observe');
      return observation;
    }),
    verifyConfiguration: vi.fn().mockImplementation(async () => {
      events.push('configuration');
    }),
    execute: vi.fn().mockImplementation(async () => {
      events.push('provider');
      return {
        kind: 'answer',
        text: 'Respuesta sintética',
        terminalProof: proof,
      };
    }),
  };
  const reservation = {
    resourceKey: observation.resourceKey,
    fence: '8',
    operationRef: 'attempt',
  };
  const reserve = {
    execute: vi.fn().mockImplementation(async () => {
      events.push('reserve');
      return reservation;
    }),
  };
  const release = {
    execute: vi.fn().mockImplementation(async () => {
      events.push('release');
    }),
  };
  const checkpoint = vi
    .fn()
    .mockImplementation(
      async (work: (manager: EntityManager) => Promise<unknown>) => {
        events.push('checkpoint');
        return work(manager);
      },
    );
  const armDispatch = vi.fn<NodiaAiStageContext['armDispatch']>().mockImplementation(async (_selection, _runtime, validate) => {
    events.push('arm');
    await validate?.(manager);
    return new Date(Math.min(claim.run.deadline_at.getTime(), Date.now() + policy.timing.provider_dispatch_seconds * 1000));
  });
  const context: NodiaAiStageContext = {
    checkpoint,
    armDispatch,
    signal: new AbortController().signal,
  };
  const build = new BuildNodiaAiContextUseCase(
    knowledge as unknown as LoadNodiaAiKnowledgeUseCase,
    policy,
  );
  const tools = {
    descriptors: vi.fn().mockResolvedValue(NODIA_AI_KNOWLEDGE_TOOLS),
    execute: vi.fn().mockResolvedValue({ items: [] }),
    progress: vi.fn().mockResolvedValue(undefined),
  };
  const preferences = { loadForContext: vi.fn().mockResolvedValue([]) };
  const snapshots = {
    latest: vi.fn<NodiaAiContextSnapshotService['latest']>().mockResolvedValue(null),
    insert: vi.fn<NodiaAiContextSnapshotService['insert']>().mockImplementation(async (_manager, input) => ({
      id: 'd7d41d3e-f636-450e-89c5-65cc64f925ec', conversation_id: input.conversationId,
      revision: 1, through_message_seq: input.throughSeq, source_hash: input.sourceHash,
      summary: input.summary, scope_manifest: input.scopeManifest,
      builder_contract_version: input.builderContractVersion, created_at: new Date(),
    })),
  };
  const sourceHash = '9'.repeat(64);
  const historyReader = {
    fingerprint: vi.fn<LoadNodiaAiContextHistoryUseCase['fingerprint']>().mockResolvedValue(sourceHash),
    load: vi.fn<LoadNodiaAiContextHistoryUseCase['load']>().mockImplementation(async (_manager, input) => {
      const rows = await query('SELECT id,seq::text,role,author_id::text,source_scope_manifest',
        [input.conversationId, input.throughSeq]) as { id: string; seq: string; role: string;
        author_id: string | null; source_scope_manifest: unknown }[];
      const selected = rows.filter((row) => BigInt(row.seq) > BigInt(input.afterSeq ?? '0') && BigInt(row.seq) <= BigInt(input.throughSeq));
      const authorized = new Set(input.moduleRoutes);
      const ids = selected.filter((row) => isNodiaAiScopeVisible(row.source_scope_manifest, authorized) &&
        (row.role === 'assistant' || row.author_id === input.actorId)).map((row) => row.id);
      const parts = ids.length ? await query('SELECT message_id,kind,text,attachment_id', [ids]) as {
        message_id: string; kind: string; text: string | null; attachment_id?: string | null;
      }[] : [];
      const history: ContextHistoryItem[] = selected.map((row) => ({
        seq: row.seq, role: row.role, scope: ids.includes(row.id) ? row.source_scope_manifest : null,
        parts: ids.includes(row.id) ? parts.filter((part) => part.message_id === row.id).map((part) => ({
          kind: part.kind, text: part.text, ...(part.attachment_id ? { attachment_id: part.attachment_id } : {}),
        })) : [],
      }));
      return { history, complete: true, throughSeq: selected.at(-1)?.seq ?? input.afterSeq ?? '0' };
    }),
  };
  const compaction = new BuildNodiaAiCompactionUseCase(policy);
  const recovery = { load: vi.fn<LoadNodiaAiRecoveryRefsUseCase['load']>().mockResolvedValue({ schema_version: 1,
    pending_references: [], historical_references: [], historical_total: '0', historical_included: 0, historical_more: false }) };
  const toolSelection = {
    verifySelection: vi.fn<(manager: EntityManager, claim: NodiaAiClaim) => Promise<void>>().mockResolvedValue(undefined),
    activateSelection: vi.fn<NodiaAiToolSelectionFlowUseCase['activateSelection']>().mockResolvedValue(undefined),
    discoveryIndex: vi.fn<(manager: EntityManager, claim: NodiaAiClaim) => Promise<Record<string, never> | undefined>>().mockResolvedValue(undefined),
  };
  const cleanupProofs = { execute: vi.fn<CleanupNodiaAiRuntimeProofsUseCase['execute']>().mockResolvedValue({ processed: 1, settled: 1 }) };
  const subject = new ProcessNodiaAiStageUseCase(
    knowledge as unknown as LoadNodiaAiKnowledgeUseCase,
    build,
    authorize as unknown as AuthorizeNodiaAiUseCase,
    adapter as unknown as NodiaAiAdapterPort,
    reserve as unknown as ReserveNodiaAiRuntimeSlotUseCase,
    release as unknown as ReleaseNodiaAiRuntimeSlotUseCase,
    policy,
    tools as unknown as ExecuteNodiaAiToolUseCase,
    preferences as unknown as NodiaAiPreferenceReaderUseCase,
    snapshots as unknown as NodiaAiContextSnapshotService,
    historyReader as unknown as LoadNodiaAiContextHistoryUseCase,
    compaction,
    recovery as unknown as LoadNodiaAiRecoveryRefsUseCase,
    toolSelection as unknown as NodiaAiToolSelectionFlowUseCase,
    cleanupProofs as unknown as CleanupNodiaAiRuntimeProofsUseCase,
    attachments,
  );
  return {
    proof,
    tools,
    preferences,
    snapshots, historyReader, compaction, recovery, sourceHash, policy, toolSelection, cleanupProofs,
    subject,
    journal,
    claim,
    context,
    adapter,
    knowledge,
    authorize,
    observation,
    reserve,
    release,
    reservation,
    events,
    query,
    manager,
    runRepository,
    actor,
    checkpoint,
    armDispatch,
  };
}

describe('Process NodiaAI stage', () => {
  function codexFixture() {
    const f = fixture();
    const adapterIdentity = { providerKey: 'openai' as const, contractVersion: 'nodia-ai-codex-chat/1' as const, connectionId: '2' };
    f.claim.run.selection_snapshot.mode = 'token_plan_agentic';
    f.claim.attempt.id = '293a45fa-49ed-4641-93fd-106832bdd0b7';
    f.claim.attempt.worker_id = '293a45fa-49ed-4641-93fd-106832bdd0b8';
    f.claim.job.id = '293a45fa-49ed-4641-93fd-106832bdd0b9';
    Object.assign(f.observation, { source: 'codex_live_session_and_catalog', adapterContractVersion: 'nodia-ai-codex-chat/1',
      adapterIdentity, resourceKey: 'codex-profile:' + 'a'.repeat(64), supportsMcp: true });
    f.claim.run.context_manifest.resource_key = f.observation.resourceKey;
    f.claim.run.context_manifest.adapter_identity = { provider_key: 'openai', contract_version: 'nodia-ai-codex-chat/1', connection_id: '2' };
    f.reservation.resourceKey = f.observation.resourceKey; f.reservation.operationRef = f.claim.attempt.id;
    Object.assign(f.proof, { engine: 'agentic', attemptId: f.claim.attempt.id, operationRef: f.claim.attempt.id,
      resourceKey: f.observation.resourceKey, adapterIdentity });
    return f;
  }
  it('binds Codex observation identity before dispatch and routes callbacks through fenced checkpoints and the common gateway', async () => {
    const f = codexFixture(), signal = f.context.signal;
    const originalQuery = f.query.getMockImplementation()!;
    f.query.mockImplementation(async (sql, args) => sql.startsWith('SELECT resource_key FROM nodia_ai_runtime_slots')
      ? [{ resource_key: f.observation.resourceKey }] : originalQuery(sql, args));
    f.adapter.execute.mockImplementationOnce(async (request: NodiaAiAdapterRequest) => {
      await request.onLeaseCheck!(signal);
      await request.onProtocolProgress!(4, signal, 1);
      await request.onToolCall!({ callId: 'synthetic-callback', name: 'nodia_knowledge_index', arguments: {} }, signal);
      return { kind: 'answer', text: 'Respuesta sintética', terminalProof: f.proof };
    });
    const outcome = await f.subject.execute(f.claim, f.context);
    expect(outcome.status).toBe('completed');
    expect(f.armDispatch).toHaveBeenCalledWith(f.claim.run.selection_snapshot, { ...f.reservation,
      adapterIdentity: { providerKey: 'openai', contractVersion: 'nodia-ai-codex-chat/1', connectionId: '2' }, sessionGeneration: f.observation.sessionGeneration }, expect.any(Function));
    expect(f.tools.progress).toHaveBeenCalledExactlyOnceWith(f.claim, f.context, 4, 1);
    expect(f.tools.execute).toHaveBeenCalledExactlyOnceWith(f.claim, f.context,
      { callId: 'synthetic-callback', name: 'nodia_knowledge_index', arguments: {} });
    const slot = f.query.mock.calls.find(([sql]) => sql.startsWith('SELECT resource_key FROM nodia_ai_runtime_slots'))!;
    expect(slot[0]).toContain("state='held'"); expect(slot[0]).toContain('FOR SHARE');
    expect(slot[1]).toEqual([f.reservation.resourceKey, f.claim.job.id, f.claim.attempt.worker_id, '8', f.claim.attempt.id]);
  });
  it('accounts every Codex protocol message even when no tools are attested and revokes callbacks after lease loss', async () => {
    const f = codexFixture(); f.observation.supportsMcp = false;
    await f.subject.execute(f.claim, f.context);
    const request = f.adapter.execute.mock.calls[0][0] as NodiaAiAdapterRequest;
    expect(request.onToolCall).toBeUndefined();
    await request.onProtocolProgress!(7, f.context.signal, 2);
    expect(f.tools.progress).toHaveBeenCalledExactlyOnceWith(f.claim, f.context, 7, 2);
    await expect(request.onLeaseCheck!(f.context.signal)).rejects.toThrow('lease_lost');
    const controller = new AbortController(); controller.abort();
    await expect(request.onProtocolProgress!(8, controller.signal)).rejects.toThrow('lease_lost');
    expect(f.tools.progress).toHaveBeenCalledTimes(1);
    expect(f.tools.execute).not.toHaveBeenCalled();
  });
  it.each(['manifest_missing', 'manifest_connection', 'observation_connection', 'implicit_identity', 'changed_contract'])('does not reserve or dispatch Codex after %s', async (change) => {
    const f = codexFixture();
    if (change === 'manifest_missing') delete f.claim.run.context_manifest.adapter_identity;
    if (change === 'manifest_connection') (f.claim.run.context_manifest.adapter_identity as Record<string, string>).connection_id = '4';
    if (change === 'observation_connection') Object.assign(f.observation, { adapterIdentity: { providerKey: 'openai', contractVersion: 'nodia-ai-codex-chat/1', connectionId: '4' } });
    if (change === 'implicit_identity') { Reflect.deleteProperty(f.observation, 'adapterIdentity'); Reflect.deleteProperty(f.observation, 'adapterContractVersion'); }
    if (change === 'changed_contract') Object.assign(f.observation, { adapterContractVersion: 'nodia-ai-gemini-chat/1' });
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow('eligibility_changed');
    expect(f.reserve.execute).not.toHaveBeenCalled(); expect(f.armDispatch).not.toHaveBeenCalled(); expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('marks only an exact direct Agentic observation timeout retryable before reserving or sending', async () => {
    const f = fixture();
    f.claim.run.selection_snapshot.mode = 'token_plan_agentic';
    Object.assign(f.observation, { available: false, reason: 'agentic_timeout',
      adapterContractVersion: 'nodia-ai-gemini-chat/1' });
    const before = structuredClone(f.claim);
    await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject({
      errorCode: 'nodia_ai:agentic_observation_timeout', retryable: true,
    });
    expect(f.reserve.execute).not.toHaveBeenCalled();
    expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
    expect(f.claim).toEqual(before);
  });
  it.each(['resourceKey', 'sessionGeneration', 'configurationGeneration'] as const)(
    'does not retry an observation timeout with changed %s', async (field) => {
      const f = fixture();
      f.claim.run.selection_snapshot.mode = 'token_plan_agentic';
      Object.assign(f.observation, { available: false, reason: 'agentic_timeout',
        adapterContractVersion: 'nodia-ai-gemini-chat/1', [field]: 'changed' });
      await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject({
        errorCode: 'nodia_ai:eligibility_changed', retryable: false,
      });
      expect(f.reserve.execute).not.toHaveBeenCalled();
      expect(f.armDispatch).not.toHaveBeenCalled();
      expect(f.adapter.execute).not.toHaveBeenCalled();
    },
  );
  it.each([
    ['resourceKey', 'resource_key'], ['sessionGeneration', 'session_generation'],
    ['configurationGeneration', 'configuration_generation'],
  ])('does not retry matching but empty %s identity', async (field, storedField) => {
    const f = fixture();
    f.claim.run.selection_snapshot.mode = 'token_plan_agentic';
    f.claim.run.context_manifest[storedField] = '';
    Object.assign(f.observation, { available: false, reason: 'agentic_timeout',
      adapterContractVersion: 'nodia-ai-gemini-chat/1', [field]: '' });
    await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject({
      errorCode: 'nodia_ai:eligibility_changed', retryable: false,
    });
    expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it.each(['agentic_unavailable', 'session_required', 'agentic_session_required',
    'model_unavailable', 'model_option_mismatch', 'adapter_protocol_unverified', 'runtime_busy', null])(
    'does not retry generic or permanent observation reason %s', async (reason) => {
      const f = fixture();
      f.claim.run.selection_snapshot.mode = 'token_plan_agentic';
      Object.assign(f.observation, { available: false, reason, adapterContractVersion: 'nodia-ai-gemini-chat/1' });
      await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject({
        errorCode: 'nodia_ai:eligibility_changed', retryable: false,
      });
      expect(f.reserve.execute).not.toHaveBeenCalled();
      expect(f.armDispatch).not.toHaveBeenCalled();
      expect(f.adapter.execute).not.toHaveBeenCalled();
    },
  );
  it.each(['token_plan_web', 'api_key'] as const)('does not widen retries to mode %s', async (mode) => {
    const f = fixture();
    f.claim.run.selection_snapshot.mode = mode;
    Object.assign(f.observation, { available: false, reason: 'agentic_timeout',
      adapterContractVersion: 'nodia-ai-gemini-chat/1' });
    await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject({ retryable: false });
    expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('does not treat a different adapter contract timeout as a Gemini observation timeout', async () => {
    const f = fixture();
    f.claim.run.selection_snapshot.mode = 'token_plan_agentic';
    Object.assign(f.observation, { available: false, reason: 'agentic_timeout', adapterContractVersion: 'unreviewed' });
    await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject({ retryable: false });
    expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('does not retry observation timeout after cancellation or without a frozen resource match', async () => {
    for (const cancelled of [false, true]) {
      const f = fixture();
      f.claim.run.selection_snapshot.mode = 'token_plan_agentic';
      Object.assign(f.observation, { available: false, reason: 'agentic_timeout',
        adapterContractVersion: 'nodia-ai-gemini-chat/1', ...(!cancelled ? { resourceKey: null } : {}) });
      if (cancelled) f.context.signal = AbortSignal.abort();
      await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject({ retryable: false });
      expect(f.armDispatch).not.toHaveBeenCalled();
      expect(f.adapter.execute).not.toHaveBeenCalled();
    }
  });
  it('keeps delegated observation timeout fail-closed because the destination resource key is not frozen', async () => {
    const f = fixture('delegated_inference');
    f.claim.run.routing_snapshot = { schema_version: 1, enabled: true, revision: 1, target: {
      selection: { ...f.claim.run.selection_snapshot, mode: 'token_plan_agentic' },
      configuration_generation: f.observation.configurationGeneration,
      session_generation: f.observation.sessionGeneration,
    } };
    Object.assign(f.observation, { available: false, reason: 'agentic_timeout',
      adapterContractVersion: 'nodia-ai-gemini-chat/1' });
    await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject({
      errorCode: 'nodia_ai:eligibility_changed', retryable: false,
    });
    expect(f.reserve.execute).not.toHaveBeenCalled();
    expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('revalidates the same direct selection after the observation recovers without fallback or a prior inference', async () => {
    const f = fixture();
    f.claim.run.selection_snapshot.mode = 'token_plan_agentic';
    Object.assign(f.observation, { available: false, reason: 'agentic_timeout',
      adapterContractVersion: 'nodia-ai-gemini-chat/1' });
    const selection = structuredClone(f.claim.run.selection_snapshot);
    const deadline = f.claim.run.deadline_at.getTime();
    await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject({ retryable: true });
    expect(f.adapter.execute).not.toHaveBeenCalled();
    Object.assign(f.observation, { available: true, reason: null });
    await f.subject.execute(f.claim, f.context);
    expect(f.adapter.observe.mock.calls).toEqual([[selection, f.context.signal], [selection, f.context.signal]]);
    expect(f.armDispatch).toHaveBeenCalledOnce();
    expect(f.adapter.execute).toHaveBeenCalledOnce();
    expect(f.adapter.execute).toHaveBeenCalledWith(expect.objectContaining({ selection }), f.context.signal);
    expect(f.claim.run.deadline_at.getTime()).toBe(deadline);
  });
  it('passes the armed absolute provider deadline unchanged instead of renewing it after preparation', async () => {
    const f = fixture();
    const armedDeadline = new Date(Date.now() + 17000);
    f.armDispatch.mockResolvedValueOnce(armedDeadline);
    await f.subject.execute(f.claim, f.context);
    expect(f.adapter.execute).toHaveBeenCalledOnce();
    expect(f.adapter.execute).toHaveBeenCalledWith(
      expect.objectContaining({ deadlineAt: armedDeadline }), f.context.signal,
    );
  });
  const selectionAttemptId = 'a70f4bf2-899e-46a7-8d61-7b8323c28f1a';
  const selectionReceiptId = '089767bd-e595-45ce-8cb2-152012e35d73';
  function selectionState(phase: 'selection_requested' | 'ack_pending') {
    return { schema_version: 1, phase, catalog_hash: 'a'.repeat(64), request: {
      attempt_id: selectionAttemptId, tool_call_id: selectionReceiptId, capability_ids: ['fixture_capability'],
      profile: { schema_version: 1, profile_id: 'selected_capabilities', revision: 1, sha256: 'b'.repeat(64) },
      tool_contracts: Object.fromEntries(['fixture_capability', ...Array.from({ length: 7 }, (_, i) => `technical_${i}`)]
        .map((name) => [name, 'c'.repeat(64)])),
    } };
  }
  it('seals discovery with its terminal proof without persisting an intermediate assistant answer or expanding the grant', async () => {
    const f = fixture();
    f.claim.attempt.id = selectionAttemptId;
    f.proof.attemptId = selectionAttemptId;
    f.claim.run.selection_snapshot.mode = 'token_plan_agentic';
    f.observation.supportsMcp = true;
    f.claim.run.context_manifest.tool_selection = selectionState('selection_requested');
    const result = await f.subject.execute(f.claim, f.context);
    expect(result).toMatchObject({ status: 'continue', nextStage: 'tool_selection', terminalProof: f.proof });
    if ('persist' in result) await result.persist?.(f.manager);
    expect(f.release.execute).toHaveBeenCalledExactlyOnceWith(f.claim, f.reservation, f.proof, f.manager);
    expect(f.claim.run.context_manifest.tool_selection).toMatchObject({ phase: 'ack_pending' });
    expect(f.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO nodia_ai_messages'))).toBe(false);
    expect(f.toolSelection.activateSelection).not.toHaveBeenCalled();
    expect(f.cleanupProofs.execute).not.toHaveBeenCalled();
  });
  it('does not advance a selection belonging to another provider attempt', async () => {
    const f = fixture();
    f.claim.run.selection_snapshot.mode = 'token_plan_agentic';
    f.observation.supportsMcp = true;
    f.claim.run.context_manifest.tool_selection = selectionState('selection_requested');
    expect(await f.subject.execute(f.claim, f.context)).toMatchObject({ status: 'completed' });
    expect(f.toolSelection.activateSelection).not.toHaveBeenCalled();
  });
  it('cannot activate a discovery selection with a cancelled native proof, even if the adapter labels its text as an answer', async () => {
    const f = fixture();
    f.claim.attempt.id = selectionAttemptId;
    f.claim.run.selection_snapshot.mode = 'token_plan_agentic';
    f.observation.supportsMcp = true;
    f.claim.run.context_manifest.tool_selection = selectionState('selection_requested');
    f.adapter.execute.mockResolvedValue({ kind: 'answer', text: 'Contradictory synthetic reply',
      terminalProof: { ...f.proof, outcome: 'cancelled' } } as never);
    const outcome = await f.subject.execute(f.claim, f.context);
    expect(outcome).toEqual({ status: 'unknown', errorCode: 'nodia_ai:invalid_provider_response' });
    expect(f.toolSelection.activateSelection).not.toHaveBeenCalled();
    expect(f.cleanupProofs.execute).not.toHaveBeenCalled();
    expect(f.release.execute).not.toHaveBeenCalled();
  });
  function activationFixture(delegated = false) {
    const f = fixture('tool_selection');
    f.claim.run.context_manifest.tool_selection = selectionState('ack_pending');
    const origin = { id: selectionAttemptId, job_id: f.claim.job.id, phase: 'completed', ended_at: new Date(),
      selection_snapshot: { ...f.claim.run.selection_snapshot, mode: 'token_plan_agentic' },
      stage_key: delegated ? 'delegated_inference' : 'inference', routing_phase: delegated ? 'delegated' : 'base' };
    const repository = { findOneBy: vi.fn().mockResolvedValue(origin) };
    vi.mocked(f.manager.getRepository).mockImplementation((entity) =>
      (entity === NodiaAiJobAttempt ? repository : f.runRepository) as never);
    let ack = true;
    const original = f.query.getMockImplementation()!;
    f.query.mockImplementation(async (sql, args) => sql === 'SELECT id FROM nodia_ai_jobs WHERE dedup_key=$1'
      ? ack ? [{ id: selectionReceiptId }] : [] : original(sql, args));
    f.cleanupProofs.execute.mockImplementation(async () => { ack = false; return { processed: 1, settled: 1 }; });
    return { ...f, origin, repository };
  }
  it.each([false, true])('acknowledges discovery outside SQL before activating the next generation, delegated=%s', async (delegated) => {
    const f = activationFixture(delegated);
    const outcome = await f.subject.execute(f.claim, f.context);
    expect(f.cleanupProofs.execute).toHaveBeenCalledExactlyOnceWith(selectionReceiptId);
    expect(f.toolSelection.activateSelection).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ status: 'continue', nextStage: delegated ? 'delegated_inference' : 'inference' });
    if ('persist' in outcome) await outcome.persist?.(f.manager);
    expect(f.toolSelection.activateSelection).toHaveBeenCalledExactlyOnceWith(f.manager, f.claim);
    expect(f.adapter.observe).not.toHaveBeenCalled();
    expect(f.reserve.execute).not.toHaveBeenCalled();
    expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('leaves an unacknowledged discovery on bounded pre-dispatch retry without another inference', async () => {
    const f = activationFixture();
    f.cleanupProofs.execute.mockResolvedValue({ processed: 1, settled: 0 });
    await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject({ errorCode: 'nodia_ai:tool_selection_ack_pending', retryable: true });
    expect(f.toolSelection.activateSelection).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it.each(['catalog_changed', 'capability_denied'])('rejects %s during activation preflight before scheduling another generation', async (code) => {
    const f = activationFixture();
    f.toolSelection.verifySelection.mockRejectedValue(new Error('nodia_ai:' + code));
    await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject({ errorCode: 'nodia_ai:' + code, retryable: false });
    expect(f.toolSelection.activateSelection).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
    expect(f.armDispatch).not.toHaveBeenCalled();
  });
  it.each(['unknown', 'dispatch_armed', 'failed'])('cannot continue discovery whose source remains %s', async (phase) => {
    const f = activationFixture();
    f.origin.phase = phase;
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow('tool_selection_invalid');
    expect(f.cleanupProofs.execute).not.toHaveBeenCalled();
    expect(f.toolSelection.activateSelection).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  const memory: NodiaAiContextPreference = {
    id: '7708b6d1-4a3c-4c08-8ea3-c57a634aeb57', revision: 1,
    scope_key: 'finance', scope: {}, key: 'expense_category_id', value: '17',
    value_label: 'Comida', scope_label: null,
  };
  it('sends current accepted preferences as data, persisting references instead of copied memory', async () => {
    const f = fixture();
    f.preferences.loadForContext.mockResolvedValue([memory]);
    await f.subject.execute(f.claim, f.context);
    expect(f.preferences.loadForContext).toHaveBeenCalledTimes(3);
    const request = (f.adapter.execute.mock.calls as unknown as [{ canonicalPrompt: string }][])[0][0];
    expect(JSON.parse(request.canonicalPrompt).accepted_preferences).toEqual([memory]);
    expect(JSON.stringify(f.claim.run.context_manifest)).not.toContain(memory.value_label);
    expect(f.adapter.execute).toHaveBeenCalledOnce();
  });
  it('stops before dispatch when the authorized discovery index changes after context assembly', async () => {
    const f = fixture();
    f.toolSelection.discoveryIndex.mockResolvedValueOnce({}).mockResolvedValue(undefined);
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow('context_sources_changed');
    expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('blocks without a profile reservation when accepted memory changes during provider observation', async () => {
    const f = fixture();
    f.preferences.loadForContext.mockResolvedValueOnce([memory]).mockResolvedValue([]);
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow('preferences_changed');
    expect(f.reserve.execute).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('checks memory again at durable arming when it changes during profile reservation', async () => {
    const f = fixture();
    f.preferences.loadForContext.mockResolvedValue([memory]);
    f.reserve.execute.mockImplementationOnce(async () => {
      f.preferences.loadForContext.mockResolvedValue([]);
      return f.reservation;
    });
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow('preferences_changed');
    expect(f.armDispatch).toHaveBeenCalledOnce();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('does not reserve or dispatch when the ToolGateway rejects the MCP catalog envelope', async () => {
    const f = fixture();
    f.claim.run.selection_snapshot.mode = 'token_plan_agentic';
    f.observation.supportsMcp = true;
    f.tools.descriptors.mockRejectedValueOnce(
      new NodiaAiKnownPreDispatchError('nodia_ai:tool_catalog_limit'),
    );
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'nodia_ai:tool_catalog_limit',
    );
    expect(f.reserve.execute).not.toHaveBeenCalled();
    expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('moves an explicitly opted-in typed Web request to one Agentic stage only after releasing the completed Web profile', async () => {
    const f = fixture();
    f.claim.run.routing_snapshot = {
      schema_version: 1,
      enabled: true,
      revision: 2,
      target: {
        selection: {
          ...f.claim.run.selection_snapshot,
          mode: 'token_plan_agentic',
        },
        configuration_generation: f.observation.configurationGeneration,
        session_generation: f.observation.sessionGeneration,
      },
    };
    f.adapter.execute.mockResolvedValueOnce({
      kind: 'delegation_request',
      reason: 'Need tools',
      terminalProof: f.proof,
    });
    const outcome = await f.subject.execute(f.claim, f.context);
    expect(outcome.status).toBe('continue');
    if (outcome.status !== 'continue') throw new Error('Expected delegation');
    expect(outcome.nextStage).toBe('delegated_inference');
    expect(f.release.execute).not.toHaveBeenCalled();
    await outcome.persist?.(f.manager);
    expect(f.release.execute).toHaveBeenCalledOnce();
    expect(f.claim.run.selection_snapshot.mode).toBe('token_plan_web');
    expect(f.adapter.execute).toHaveBeenCalledOnce();
  });
  it('does not treat a Web delegation request as consent when the switch is off', async () => {
    const f = fixture();
    f.claim.run.routing_snapshot = {
      schema_version: 1,
      enabled: false,
      revision: 1,
      target: null,
    };
    f.adapter.execute.mockResolvedValueOnce({
      kind: 'delegation_request',
      reason: 'Please select Agentic',
      terminalProof: f.proof,
    });
    const outcome = await f.subject.execute(f.claim, f.context);
    expect(outcome.status).toBe('completed');
    expect(f.adapter.execute).toHaveBeenCalledOnce();
  });
  it('uses the frozen Agentic destination for the delegated stage and exposes only the two registered technical knowledge reads', async () => {
    const f = fixture('delegated_inference');
    f.observation.supportsMcp = true;
    const selection = {
      ...f.claim.run.selection_snapshot,
      mode: 'token_plan_agentic' as const,
      model_id: 'configured-agentic-model',
    };
    f.claim.run.routing_snapshot = {
      schema_version: 1,
      enabled: true,
      revision: 2,
      target: {
        selection,
        configuration_generation: f.observation.configurationGeneration,
        session_generation: f.observation.sessionGeneration,
      },
    };
    const original = f.query.getMockImplementation()!;
    f.query.mockImplementation(async (sql) =>
      sql.startsWith('SELECT routing_enabled')
        ? [{ routing_enabled: true, routing_revision: 2 }]
        : original(sql),
    );
    await f.subject.execute(f.claim, f.context);
    expect(f.armDispatch).toHaveBeenCalledWith(selection, f.reservation, expect.any(Function));
    const call = (
      f.adapter.execute.mock.calls as unknown as [
        {
          tools: { name: string }[];
          onToolCall: (call: unknown, signal: AbortSignal) => Promise<unknown>;
          onProtocolProgress: (
            total: number,
            signal: AbortSignal,
            unforwardedToolRequests?: number,
          ) => Promise<void>;
        },
      ][]
    )[0][0];
    expect(call.tools.map((tool) => tool.name)).toEqual([
      'nodia_knowledge_index',
      'nodia_knowledge_get',
    ]);
    const toolCall = {
      callId: 'callback',
      name: 'nodia_knowledge_index',
      arguments: {},
    };
    await call.onToolCall(toolCall, f.context.signal);
    expect(f.tools.execute).toHaveBeenCalledWith(f.claim, f.context, toolCall);
    await call.onProtocolProgress(7, f.context.signal, 2);
    expect(f.tools.progress).toHaveBeenCalledWith(f.claim, f.context, 7, 2);
  });
  it('blocks a delegated dispatch after consent is withdrawn without falling back or reserving an Agentic profile', async () => {
    const f = fixture('delegated_inference');
    f.observation.supportsMcp = true;
    f.claim.run.routing_snapshot = {
      schema_version: 1,
      enabled: true,
      revision: 2,
      target: {
        selection: {
          ...f.claim.run.selection_snapshot,
          mode: 'token_plan_agentic',
        },
        configuration_generation: f.observation.configurationGeneration,
        session_generation: f.observation.sessionGeneration,
      },
    };
    const original = f.query.getMockImplementation()!;
    f.query.mockImplementation(async (sql) =>
      sql.startsWith('SELECT routing_enabled')
        ? [{ routing_enabled: false, routing_revision: 3 }]
        : original(sql),
    );
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'nodia_ai:routing_disabled',
    );
    expect(f.reserve.execute).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('rejects withdrawn delegation under the final dispatch lock after reserving without sending', async () => {
    const f = fixture('delegated_inference');
    f.observation.supportsMcp = true;
    f.claim.run.routing_snapshot = {
      schema_version: 1,
      enabled: true,
      revision: 2,
      target: {
        selection: { ...f.claim.run.selection_snapshot, mode: 'token_plan_agentic' },
        configuration_generation: f.observation.configurationGeneration,
        session_generation: f.observation.sessionGeneration,
      },
    };
    let routing = { routing_enabled: true, routing_revision: 2 };
    const original = f.query.getMockImplementation()!;
    f.query.mockImplementation(async (sql, parameters) =>
      sql.startsWith('SELECT routing_enabled') ? [routing] : original(sql, parameters),
    );
    f.reserve.execute.mockImplementationOnce(async () => {
      routing = { routing_enabled: false, routing_revision: 3 };
      return f.reservation;
    });

    const failure = await f.subject.execute(f.claim, f.context).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(NodiaAiKnownPreDispatchError);
    expect(failure).toMatchObject({ errorCode: 'nodia_ai:routing_disabled' });
    expect(f.reserve.execute).toHaveBeenCalledOnce();
    expect(f.armDispatch).toHaveBeenCalledOnce();
    expect(f.adapter.execute).not.toHaveBeenCalled();
    expect(f.tools.execute).not.toHaveBeenCalled();
  });
  it('does not delegate as a repair for a Web failure', async () => {
    const f = fixture();
    f.claim.run.routing_snapshot = {
      schema_version: 1,
      enabled: true,
      revision: 2,
      target: {
        selection: {
          ...f.claim.run.selection_snapshot,
          mode: 'token_plan_agentic',
        },
        configuration_generation: f.observation.configurationGeneration,
        session_generation: f.observation.sessionGeneration,
      },
    };
    f.adapter.execute.mockRejectedValueOnce(
      new Error('Web failed after dispatch'),
    );
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'Web failed after dispatch',
    );
    expect(f.adapter.execute).toHaveBeenCalledOnce();
    expect(f.release.execute).not.toHaveBeenCalled();
  });
  it('builds canonical authorized context, then reserves and arms before one provider dispatch', async () => {
    const f = fixture();
    const outcome = await f.subject.execute(f.claim, f.context);
    expect(outcome.status).toBe('completed');
    expect(f.events.slice(-5)).toEqual([
      'checkpoint',
      'configuration',
      'reserve',
      'arm',
      'provider',
    ]);
    expect(f.armDispatch).toHaveBeenCalledWith(
      f.claim.run.selection_snapshot,
      f.reservation,
      expect.any(Function),
    );
    const prompt = JSON.parse(
      f.adapter.execute.mock.calls[0][0].canonicalPrompt,
    );
    expect(
      prompt.messages.map((item: { content: string }) => item.content),
    ).toEqual(['Consulta sintética', '[RestrictedMessage]']);
    const partsQuery = f.query.mock.calls.find(([sql]) =>
      sql.startsWith('SELECT message_id,kind,text'),
    );
    expect(partsQuery?.[1]).toEqual([['own']]);
    expect(f.release.execute).not.toHaveBeenCalled();
    if ('persist' in outcome) await outcome.persist?.(f.manager);
    expect(f.release.execute).toHaveBeenCalledWith(
      f.claim,
      f.reservation,
      f.proof,
      f.manager,
    );
    expect(
      f.query.mock.calls.some(([sql]) =>
        sql.includes('INSERT INTO nodia_ai_messages'),
      ),
    ).toBe(true);
  });
  it('does not widen a frozen run grant when another module is assigned later', async () => {
    const f = fixture();
    f.actor.modules.push({ route: '/new-feature' });
    const outcome = await f.subject.execute(f.claim, f.context);
    expect(outcome.status).toBe('completed');
    expect(f.knowledge.execute).toHaveBeenCalledWith([
      '/finance',
      '/tools/nodia-ai',
    ]);
  });
  it('context phase persists manifest without reserving a profile or dispatching', async () => {
    const f = fixture('context');
    const outcome = await f.subject.execute(f.claim, f.context);
    expect(outcome).toMatchObject({
      status: 'continue',
      nextStage: 'inference',
    });
    expect(f.adapter.observe).not.toHaveBeenCalled();
    expect(f.reserve.execute).not.toHaveBeenCalled();
    if ('persist' in outcome) await outcome.persist?.(f.manager);
    expect(f.runRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        context_manifest: expect.objectContaining({
          through_seq: '2',
          knowledge_release: 'release',
        }),
      }),
    );
  });
  it.each(['unknown', 'tool_execute'])(
    'rejects unsupported stage %s before any work',
    async (stage) => {
      const f = fixture(stage);
      await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
        'unsupported_stage',
      );
      expect(f.checkpoint).not.toHaveBeenCalled();
    },
  );
  it('rejects changed pinned knowledge release before reading or dispatch', async () => {
    const f = fixture();
    f.claim.run.context_manifest.knowledge_release = 'old-release';
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'knowledge_release_changed',
    );
    expect(f.checkpoint).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it.each([
    'resourceKey',
    'sessionGeneration',
    'configurationGeneration',
    'available',
  ])(
    'rejects changed eligibility %s before reserve/dispatch',
    async (field) => {
      const f = fixture();
      Object.assign(f.observation, {
        [field]: field === 'available' ? false : 'changed',
      });
      await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
        'eligibility_changed',
      );
      expect(f.reserve.execute).not.toHaveBeenCalled();
      expect(f.armDispatch).not.toHaveBeenCalled();
    },
  );
  it('revocation during the checkpoint prevents provider observation and dispatch', async () => {
    const f = fixture();
    f.authorize.execute.mockRejectedValueOnce(new Error('revoked'));
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'revoked',
    );
    expect(f.adapter.observe).not.toHaveBeenCalled();
    expect(f.armDispatch).not.toHaveBeenCalled();
  });
  it('fence loss before arm never dispatches', async () => {
    const f = fixture();
    f.armDispatch.mockRejectedValueOnce(new Error('lease-lost'));
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'lease-lost',
    );
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('unknown provider outcome does not seal a fabricated message or release resource', async () => {
    const f = fixture();
    f.adapter.execute.mockRejectedValueOnce(new Error('unknown'));
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'unknown',
    );
    expect(f.adapter.execute).toHaveBeenCalledTimes(1);
    expect(f.release.execute).not.toHaveBeenCalled();
    expect(
      f.query.mock.calls.some(([sql]) =>
        sql.includes('INSERT INTO nodia_ai_messages'),
      ),
    ).toBe(false);
  });
  it('Web delegation without a published gateway never routes or runs MCP', async () => {
    const f = fixture();
    f.adapter.execute.mockResolvedValueOnce({
      kind: 'delegation_request',
      reason: 'Read data',
    });
    const outcome = await f.subject.execute(f.claim, f.context);
    expect(outcome.status).toBe('completed');
    expect(f.adapter.execute).toHaveBeenCalledTimes(1);
    if ('persist' in outcome) await outcome.persist?.(f.manager);
    const part = f.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO nodia_ai_message_parts'),
    );
    expect(part?.[1][2]).toBe('Read data');
    expect(f.journal.events).toHaveLength(1);
    expect(f.journal.events[0].public_payload).toEqual({
      kind: 'message_sealed',
      payload: { message_id: expect.any(String), status: 'sealed' },
    });
    expect(JSON.stringify(f.journal.events)).not.toContain('Read data');
  });
});

describe('AI-34 compaction orchestration', () => {
  const compacted = (): NodiaAiCompactionSummary => ({
    schema_version: 1, facts: [], decisions: [], questions: [], entities: [],
    requirements: [{ text: 'Necesito una reserva para Casa Faro.', source_seqs: ['1'] }],
  });
  function longFixture(stage = 'context') {
    const attachments = {
      content: vi.fn(),
      usageForAdmission: vi.fn().mockResolvedValue({ chat_bytes: '0', owner_bytes: '0' }),
    };
    const f = fixture(stage, attachments as unknown as ManageNodiaAiAttachmentUseCase);
    const history: ContextHistoryItem[] = [
      { seq: '1', role: 'user', scope: { schema_version: 1, module_routes: ['/finance', '/tools/nodia-ai'] },
        parts: [{ kind: 'text', text: 'Necesito una reserva para Casa Faro. ' + 'Contenido sintético sin operaciones. '.repeat(4200) },
          { kind: 'audio', text: null, attachment_id: 'historical-audio' }] },
      { seq: '2', role: 'user', scope: { schema_version: 1, module_routes: [] },
        parts: [{ kind: 'text', text: '¿Qué falta definir?' }] },
    ];
    f.historyReader.load.mockResolvedValue({ history, complete: true, throughSeq: '2' });
    f.adapter.execute.mockResolvedValue({ kind: 'answer', text: JSON.stringify(compacted()), terminalProof: f.proof });
    return { ...f, attachments, history };
  }
  function storedSnapshot(f: ReturnType<typeof longFixture>) {
    return {
      id: 'd7d41d3e-f636-450e-89c5-65cc64f925ec', conversation_id: f.claim.run.conversation_id,
      revision: 1, through_message_seq: '1', source_hash: f.sourceHash, summary: compacted(),
      scope_manifest: { schema_version: 1, module_routes: ['/finance', '/tools/nodia-ai'] },
      builder_contract_version: NODIA_AI_COMPACTION_BUILDER_VERSION, created_at: new Date(),
    };
  }
  it('retries the same direct Agentic observation timeout before reserving or charging compaction', async () => {
    const f = longFixture();
    f.claim.run.selection_snapshot.mode = 'token_plan_agentic';
    Object.assign(f.observation, { available: false, reason: 'agentic_timeout',
      adapterContractVersion: 'nodia-ai-gemini-chat/1' });
    await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject({
      errorCode: 'nodia_ai:agentic_observation_timeout', retryable: true,
    });
    expect(f.reserve.execute).not.toHaveBeenCalled();
    expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
    expect(f.query.mock.calls.some(([sql]) => sql.startsWith('WITH changed AS (UPDATE nodia_ai_runs SET compactions_used='))).toBe(false);
  });
  it('uses the same armed provider deadline for compaction without reconstructing a fresh window', async () => {
    const f = longFixture();
    const armedDeadline = new Date(Date.now() + 13000);
    const originalArm = f.armDispatch.getMockImplementation()!;
    f.armDispatch.mockImplementationOnce(async (...args) => {
      await originalArm(...args);
      return armedDeadline;
    });
    const outcome = await f.subject.execute(f.claim, f.context);
    expect(outcome).toMatchObject({ status: 'continue', terminalProof: f.proof });
    expect(f.adapter.execute).toHaveBeenCalledOnce();
    expect(f.adapter.execute).toHaveBeenCalledWith(
      expect.objectContaining({ deadlineAt: armedDeadline }), f.context.signal,
    );
  });
  it('compacts when the native MCP catalog and wrapper overflow even though canonical history is below the trigger', async () => {
    const f = longFixture();
    f.history[0].parts = [{ kind: 'text', text: 'Necesito una reserva para Casa Faro. ' + 'Datos. '.repeat(5000) }];
    f.claim.run.selection_snapshot.mode = 'token_plan_agentic'; f.observation.supportsMcp = true;
    const original = f.adapter.measureContext.getMockImplementation()!;
    f.adapter.measureContext.mockImplementation(async (input) => {
      const measured = await original(input);
      return input.canonicalPrompt.includes('"task":"compact_conversation"') ? measured :
        { ...measured, catalogUtf8Bytes: 240000, totalUtf8Bytes: measured.totalUtf8Bytes + 240000 };
    });
    expect(await f.subject.execute(f.claim, f.context)).toMatchObject({ status: 'continue', terminalProof: f.proof });
    expect(f.adapter.measureContext).toHaveBeenCalledTimes(2);
    expect(f.adapter.measureContext.mock.calls[0][0]).toHaveProperty('tools');
    expect(f.adapter.measureContext.mock.calls[1][0]).not.toHaveProperty('tools');
    expect(JSON.parse(f.adapter.execute.mock.calls[0][0].canonicalPrompt).task).toBe('compact_conversation');
  });
  it('rejects an oversized inference envelope before reserving or arming, without a second compaction', async () => {
    const f = longFixture('inference');
    const original = f.adapter.measureContext.getMockImplementation()!;
    f.adapter.measureContext.mockImplementation(async (input) => ({ ...await original(input), totalUtf8Bytes: 262145 }));
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow('nodia_ai:context_limit');
    expect(f.reserve.execute).not.toHaveBeenCalled(); expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled(); expect(f.snapshots.insert).not.toHaveBeenCalled();
  });
  it('reserves the duplicated first MCP listing before deciding whether context requires compaction', async () => {
    const f = longFixture();
    f.history[0].parts = [{ kind: 'text', text: 'Necesito una reserva para Casa Faro. ' + 'Datos. '.repeat(5000) }];
    f.claim.run.selection_snapshot.mode = 'token_plan_agentic'; f.observation.supportsMcp = true;
    const original = f.adapter.measureContext.getMockImplementation()!;
    f.adapter.measureContext.mockImplementation(async (input) => {
      const measured = await original(input);
      return input.canonicalPrompt.includes('"task":"compact_conversation"') ? measured :
        { ...measured, totalUtf8Bytes: 200000, firstMcpListingUpperBoundUtf8Bytes: 70000 };
    });
    expect(await f.subject.execute(f.claim, f.context)).toMatchObject({ status: 'continue', terminalProof: f.proof });
    expect(f.adapter.execute).toHaveBeenCalledOnce();
    expect(JSON.parse(f.adapter.execute.mock.calls[0][0].canonicalPrompt).task).toBe('compact_conversation');
  });
  it('cannot dispatch when the initial prompt fits but its first MCP listing cannot fit', async () => {
    const f = fixture('inference');
    const original = f.adapter.measureContext.getMockImplementation()!;
    f.adapter.measureContext.mockImplementation(async (input) => ({ ...await original(input), totalUtf8Bytes: 262144, firstMcpListingUpperBoundUtf8Bytes: 1 }));
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow('nodia_ai:context_limit');
    expect(f.reserve.execute).not.toHaveBeenCalled(); expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('rejects an oversized compaction envelope without spending its durable budget', async () => {
    const f = longFixture();
    const original = f.adapter.measureContext.getMockImplementation()!;
    f.adapter.measureContext.mockImplementation(async (input) => ({ ...await original(input), totalUtf8Bytes: 262145 }));
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow('nodia_ai:context_limit');
    expect(f.reserve.execute).not.toHaveBeenCalled(); expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('fails a measurement outage before inference and never retries or changes the selection', async () => {
    const f = fixture('inference');
    const selection = { ...f.claim.run.selection_snapshot };
    f.adapter.measureContext.mockRejectedValueOnce(new Error('private measurement unavailable'));
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow('private measurement unavailable');
    expect(f.adapter.measureContext).toHaveBeenCalledOnce(); expect(f.reserve.execute).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled(); expect(f.claim.run.selection_snapshot).toEqual(selection);
  });
  it.each(['token_plan_web', 'token_plan_agentic'] as const)(
    'compacts long context with the exact %s selection, no tools/files and an atomic durable counter', async (mode) => {
      const f = longFixture(); f.claim.run.selection_snapshot.mode = mode;
      f.observation.supportsMcp = mode === 'token_plan_agentic';
      const outcome = await f.subject.execute(f.claim, f.context);
      expect(outcome).toMatchObject({ status: 'continue', nextStage: 'inference', terminalProof: f.proof });
      expect(f.adapter.execute).toHaveBeenCalledOnce();
      const request = f.adapter.execute.mock.calls[0][0];
      expect(request.selection).toEqual(f.claim.run.selection_snapshot);
      expect(JSON.parse(request.canonicalPrompt)).toMatchObject({ task: 'compact_conversation', through_seq: '1' });
      expect(request).not.toHaveProperty('tools');
      expect(request).not.toHaveProperty('onToolCall');
      expect(request).not.toHaveProperty('attachments');
      expect(f.attachments.content).not.toHaveBeenCalled();
      expect(f.tools.descriptors).toHaveBeenCalledTimes(mode === 'token_plan_agentic' ? 1 : 0);
      const reservationIndex = f.query.mock.calls.findIndex(([sql]) => sql.startsWith('WITH changed AS (UPDATE nodia_ai_runs SET compactions_used='));
      expect(reservationIndex).toBeGreaterThan(-1);
      expect(f.query.mock.calls[reservationIndex][1]).toEqual([f.claim.run.id, f.policy.budget.compactions_per_run]);
      expect(f.query.mock.invocationCallOrder[reservationIndex]).toBeLessThan(f.adapter.execute.mock.invocationCallOrder[0]);
      expect(f.snapshots.insert).not.toHaveBeenCalled();
      expect(f.release.execute).not.toHaveBeenCalled();
      if (!('persist' in outcome)) throw new Error('Expected durable compaction');
      await outcome.persist?.(f.manager);
      expect(f.snapshots.insert).toHaveBeenCalledWith(f.manager, expect.objectContaining({
        conversationId: f.claim.run.conversation_id, throughSeq: '1', sourceHash: f.sourceHash,
        summary: compacted(), builderContractVersion: NODIA_AI_COMPACTION_BUILDER_VERSION,
      }));
      expect(f.attachments.usageForAdmission).toHaveBeenLastCalledWith(f.manager, f.claim.run.conversation_id,
        f.claim.identity.userId, expect.any(Date), f.claim.run.id);
      expect(f.claim.run.context_snapshot_id).toBe('d7d41d3e-f636-450e-89c5-65cc64f925ec');
      expect(f.claim.run.context_manifest.compaction).toMatchObject({ through_seq: '1', mode, model_id: 'fixture-model' });
      expect(f.release.execute).toHaveBeenCalledWith(f.claim, f.reservation, f.proof, f.manager);
      expect(f.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO nodia_ai_messages'))).toBe(false);
    },
  );
  it('fails invalid model JSON with its completed terminal proof, releases the profile and never overwrites history/snapshot', async () => {
    const f = longFixture(); f.adapter.execute.mockResolvedValueOnce({ kind: 'answer', text: '{broken', terminalProof: f.proof });
    const outcome = await f.subject.execute(f.claim, f.context);
    expect(outcome).toMatchObject({ status: 'failed', errorCode: 'nodia_ai:compaction_invalid', terminalProof: f.proof });
    if ('persist' in outcome) await outcome.persist?.(f.manager);
    expect(f.release.execute).toHaveBeenCalledWith(f.claim, f.reservation, f.proof, f.manager);
    expect(f.snapshots.insert).not.toHaveBeenCalled();
    expect(f.claim.run.context_snapshot_id).toBeUndefined();
    expect(f.query.mock.calls.some(([sql]) => /(?:INSERT INTO|UPDATE) nodia_ai_message/.test(sql))).toBe(false);
  });
  it.each(['observe', 'reservation'] as const)('rejects changed history after %s before sending the compaction', async (phase) => {
    const f = longFixture();
    if (phase === 'observe') f.adapter.observe.mockImplementationOnce(async () => {
      f.historyReader.fingerprint.mockResolvedValue('8'.repeat(64)); return f.observation;
    });
    else f.reserve.execute.mockImplementationOnce(async () => {
      f.historyReader.fingerprint.mockResolvedValue('8'.repeat(64)); return f.reservation;
    });
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow('nodia_ai:context_sources_changed');
    expect(f.adapter.execute).not.toHaveBeenCalled();
    expect(f.snapshots.insert).not.toHaveBeenCalled();
    expect(f.query.mock.calls.some(([sql]) => sql.startsWith('WITH changed AS (UPDATE nodia_ai_runs SET compactions_used='))).toBe(false);
  });
  it('returns a known terminal failure when sources change after the provider response', async () => {
    const f = longFixture();
    f.adapter.execute.mockImplementationOnce(async () => {
      f.historyReader.fingerprint.mockResolvedValue('8'.repeat(64));
      return { kind: 'answer', text: JSON.stringify(compacted()), terminalProof: f.proof };
    });
    const outcome = await f.subject.execute(f.claim, f.context);
    expect(outcome).toMatchObject({ status: 'failed', errorCode: 'nodia_ai:context_sources_changed', terminalProof: f.proof });
    if ('persist' in outcome) await outcome.persist?.(f.manager);
    expect(f.release.execute).toHaveBeenCalledOnce();
    expect(f.snapshots.insert).not.toHaveBeenCalled();
  });
  it('rechecks original sources again inside the persistence transaction', async () => {
    const f = longFixture(); const outcome = await f.subject.execute(f.claim, f.context);
    f.historyReader.fingerprint.mockResolvedValue('8'.repeat(64));
    if (!('persist' in outcome) || !outcome.persist) throw new Error('Expected persist');
    await expect(outcome.persist(f.manager)).rejects.toThrow('nodia_ai:context_sources_changed');
    expect(f.snapshots.insert).not.toHaveBeenCalled();
    expect(f.release.execute).not.toHaveBeenCalled();
  });
  it('rejects exhausted compaction budget inside arming without a provider send', async () => {
    const f = longFixture(); const original = f.query.getMockImplementation()!;
    f.query.mockImplementation(async (sql, args) => sql.startsWith('WITH changed AS (UPDATE nodia_ai_runs SET compactions_used=') ? [] : original(sql, args));
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow('nodia_ai:execution_limit');
    expect(f.adapter.execute).not.toHaveBeenCalled();
    expect(f.snapshots.insert).not.toHaveBeenCalled();
  });
  it.each(['chat_bytes', 'owner_bytes'] as const)('rejects insufficient %s for a snapshot reservation before consuming budget or sending', async (field) => {
    const f = longFixture();
    f.attachments.usageForAdmission.mockResolvedValue({ chat_bytes: '0', owner_bytes: '0',
      [field]: String(field === 'chat_bytes' ? f.policy.admission.chat_storage_bytes : f.policy.admission.owner_storage_bytes) });
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow('nodia_ai:storage_limit');
    expect(f.query.mock.calls.some(([sql]) => sql.startsWith('WITH changed AS (UPDATE nodia_ai_runs SET compactions_used='))).toBe(false);
    expect(f.adapter.execute).not.toHaveBeenCalled();
    expect(f.snapshots.insert).not.toHaveBeenCalled();
  });
  it('does not treat a delegation request during extraction as consent to switch mode or expose tools', async () => {
    const f = longFixture();
    f.adapter.execute.mockResolvedValueOnce({ kind: 'delegation_request', reason: 'Use tools', terminalProof: f.proof });
    const outcome = await f.subject.execute(f.claim, f.context);
    expect(outcome).toMatchObject({ status: 'failed', errorCode: 'nodia_ai:compaction_invalid', terminalProof: f.proof });
    expect(f.adapter.execute).toHaveBeenCalledOnce();
    expect(f.tools.descriptors).not.toHaveBeenCalled();
    expect(f.snapshots.insert).not.toHaveBeenCalled();
  });
  it('reuses a valid snapshot with only its bounded tail when the configured mode/model changes', async () => {
    const f = longFixture('inference');
    f.snapshots.latest.mockResolvedValue(storedSnapshot(f));
    f.historyReader.load.mockImplementation(async (_manager, input) => {
      expect(input.afterSeq).toBe('1');
      expect(input.maxBytes).toBe(Math.floor(f.policy.results.assembled_context_utf8_bytes * 3 / 4));
      return { history: [f.history[1]], throughSeq: '2', complete: true };
    });
    f.claim.run.selection_snapshot.model_id = 'another-configured-model';
    f.claim.run.selection_snapshot.mode = 'token_plan_agentic'; f.observation.supportsMcp = true;
    await f.subject.execute(f.claim, f.context);
    const request = f.adapter.execute.mock.calls[0][0];
    const prompt = JSON.parse(request.canonicalPrompt);
    expect(request.selection).toEqual(f.claim.run.selection_snapshot);
    expect(prompt.conversation_memory).toEqual(compacted());
    expect(prompt.messages).toEqual([{ role: 'user', content: '¿Qué falta definir?' }]);
    expect(f.snapshots.insert).not.toHaveBeenCalled();
    expect(f.query.mock.calls.some(([sql]) => sql.startsWith('WITH changed AS (UPDATE nodia_ai_runs SET compactions_used='))).toBe(false);
  });
  it.each(['scope', 'hash'] as const)('discards a snapshot with changed %s and rebuilds original authorized history', async (kind) => {
    const f = longFixture('inference'); const stored = storedSnapshot(f);
    if (kind === 'scope') stored.scope_manifest.module_routes = ['/revoked'];
    else stored.source_hash = 'e'.repeat(64);
    f.snapshots.latest.mockResolvedValue(stored);
    f.historyReader.load.mockResolvedValue({ history: [f.history[1]], complete: true, throughSeq: '2' });
    await f.subject.execute(f.claim, f.context);
    expect(f.historyReader.load).toHaveBeenCalledWith(f.manager, expect.objectContaining({ afterSeq: '0' }));
    expect(JSON.parse(f.adapter.execute.mock.calls[0][0].canonicalPrompt)).not.toHaveProperty('conversation_memory');
  });
  it('blocks inference on a partial raw window instead of silently treating it as full history', async () => {
    const f = longFixture('inference');
    f.historyReader.load.mockResolvedValue({ history: [f.history[0]], complete: false, throughSeq: '1' });
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow('nodia_ai:context_limit');
    expect(f.adapter.execute).not.toHaveBeenCalled();
    expect(f.reserve.execute).not.toHaveBeenCalled();
  });
  it('treats a changed live receipt/proposal as a source change instead of trusting its historical quote', async () => {
    const f = longFixture();
    f.adapter.execute.mockImplementationOnce(async () => {
      f.recovery.load.mockResolvedValue({ schema_version: 1,
        pending_references: [{ kind: 'restricted', reference_kind: 'execution', id: 'changed' }],
        historical_references: [], historical_total: '0', historical_included: 0, historical_more: false });
      return { kind: 'answer', text: JSON.stringify(compacted()), terminalProof: f.proof };
    });
    const outcome = await f.subject.execute(f.claim, f.context);
    expect(outcome).toMatchObject({ status: 'failed', errorCode: 'nodia_ai:context_sources_changed' });
    expect(f.snapshots.insert).not.toHaveBeenCalled();
  });
});

describe('AI-32 native attachment dispatch fences', () => {
  function nativeFixture(proved = true, kind: 'pdf' | 'image' | 'audio' = 'pdf') {
    const mime = { pdf: 'application/pdf', image: 'image/png', audio: 'audio/wav' }[kind];
    const attachments = {
      content: vi.fn().mockResolvedValue({
        buffer: Buffer.from('synthetic decoded document'),
        media_type: mime,
        file_name: 'synthetic.pdf',
      }),
    };
    const f = fixture(
      'inference',
      attachments as unknown as ManageNodiaAiAttachmentUseCase,
    );
    f.claim.run.input_through_seq = '1';
    Object.assign(f.observation, { verifiedModalities: proved ? [kind] : [], verifiedAttachmentMediaTypes: proved ? [mime] : [] });
    const previous = f.query.getMockImplementation()!;
    f.query.mockImplementation(async (sql: string, parameters?: unknown[]) => {
      if (sql.startsWith('SELECT message_id,kind,text'))
        return [
          {
            message_id: 'own',
            kind,
            text: null,
            attachment_id: 'fixture-attachment',
          },
        ];
      const result = await previous(sql, parameters);
      return sql.startsWith('SELECT id,seq::text')
        ? result.filter(
            (row: { seq: string }) =>
              BigInt(row.seq) <= BigInt(f.claim.run.input_through_seq),
          )
        : result;
    });
    return { ...f, attachments };
  }
  it('blocks a different MIME in the same kind before arming inference', async () => {
    for (const [kind, mime] of [['image', 'image/jpeg'], ['audio', 'audio/webm']] as const) {
      const f = nativeFixture(true, kind);
      f.attachments.content.mockResolvedValue({ buffer: Buffer.from('synthetic same-kind file'), media_type: mime, file_name: 'synthetic-file' });
      await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow('nodia_ai:modality_unavailable');
      expect(f.attachments.content).toHaveBeenCalledOnce();
      expect(f.reserve.execute).not.toHaveBeenCalled();
      expect(f.context.armDispatch).not.toHaveBeenCalled();
      expect(f.adapter.execute).not.toHaveBeenCalled();
    }
  });
  it('does not use a legacy category summary as permission to read or dispatch originals', async () => {
    const f = nativeFixture();
    Reflect.deleteProperty(f.observation, 'verifiedAttachmentMediaTypes');
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow('nodia_ai:modality_unavailable');
    expect(f.attachments.content).not.toHaveBeenCalled();
    expect(f.reserve.execute).not.toHaveBeenCalled();
    expect(f.context.armDispatch).not.toHaveBeenCalled();
  });
  it('loads the authorized private object before arming the provider and sends only the current turn', async () => {
    const f = nativeFixture();
    await f.subject.execute(f.claim, f.context);
    expect(f.attachments.content).toHaveBeenCalledWith(
      f.claim.identity,
      'fixture-attachment',
      f.context.signal,
    );
    const request = f.adapter.execute.mock.calls[0][0];
    expect(request.attachments).toEqual([
      {
        kind: 'pdf',
        media_type: 'application/pdf',
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        content_base64: Buffer.from('synthetic decoded document').toString(
          'base64',
        ),
      },
    ]);
    expect(f.attachments.content.mock.invocationCallOrder[0]).toBeLessThan(
      f.armDispatch.mock.invocationCallOrder[0],
    );
  });
  it('blocks an unproved modality without storage reads, reservation or dispatch', async () => {
    const f = nativeFixture(false);
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'nodia_ai:modality_unavailable',
    );
    expect(f.attachments.content).not.toHaveBeenCalled();
    expect(f.reserve.execute).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('never arms a generation when storage or current read authority fails', async () => {
    const f = nativeFixture();
    f.attachments.content.mockRejectedValue(
      Error('revoked during object read'),
    );
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'revoked during object read',
    );
    expect(f.context.armDispatch).not.toHaveBeenCalled();
  });
  it('propagates run cancellation to the private read and never reserves or arms inference', async () => {
    const f = nativeFixture();
    const controller = new AbortController();
    const context = { ...f.context, signal: controller.signal };
    f.attachments.content.mockImplementation(async (...args: unknown[]) => {
      expect(args[2]).toBe(controller.signal);
      controller.abort(
        new DOMException('cancelled before provider', 'AbortError'),
      );
      controller.signal.throwIfAborted();
      throw new Error('unreachable');
    });
    await expect(f.subject.execute(f.claim, context)).rejects.toThrow(
      'cancelled before provider',
    );
    expect(f.reserve.execute).not.toHaveBeenCalled();
    expect(f.context.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('keeps historical native references without resending old files', async () => {
    const f = nativeFixture();
    f.claim.run.input_through_seq = '2';
    await f.subject.execute(f.claim, f.context);
    expect(f.attachments.content).not.toHaveBeenCalled();
    const request = f.adapter.execute.mock.calls[0][0];
    expect(request.attachments).toBeUndefined();
    expect(request.canonicalPrompt).toContain('historical_file_not_resent');
  });
});
