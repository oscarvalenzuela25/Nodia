import { CodexChatRuntime } from '../../common/ai/codex/codex-chat-runtime.js';
import type { CodexRuntimeService } from '../../common/ai/codex/codex-runtime.service.js';
import type { ManageNodiaAiAttachmentUseCase } from '../../nodia-ai-attachment/use-case/manage-nodia-ai-attachment.use-case.js';
import type { StoreNodiaAiGeneratedImageUseCase } from '../../nodia-ai-attachment/use-case/store-nodia-ai-generated-image.use-case.js';
import type { NodiaAiPreferenceReaderUseCase } from '../../nodia-ai-preference/use-case/nodia-ai-preference-reader.use-case.js';
import type { NodiaAiContextPreference } from '../../nodia-ai-preference/types/preference.types.js';
import { ExecuteNodiaAiToolUseCase } from '../../nodia-ai-tools/use-case/execute-nodia-ai-tool.use-case.js';
import { toolFixture } from '../../../test/fixtures/nodia-ai-tools.fixture.js';
import type { NodiaAiToolSelectionFlowUseCase } from '../../nodia-ai-tools/use-case/nodia-ai-tool-selection-flow.use-case.js';
import type { CleanupNodiaAiRuntimeProofsUseCase } from '../../nodia-ai-runtime/use-case/cleanup-nodia-ai-runtime-proofs.use-case.js';
import type { ProcessNodiaAiInvoiceOcrStageUseCase } from '../../nodia-ai-invoice-ocr/use-case/process-nodia-ai-invoice-ocr-stage.use-case.js';
import { NodiaAiJobAttempt } from '../../nodia-ai-runtime/entities/nodia-ai-job-attempt.entity.js';
import { NodiaAiKnownPreDispatchError } from '../../nodia-ai-runtime/types/worker.types.js';
import {
  ExecuteNodiaAiKnowledgeToolUseCase,
  NODIA_AI_KNOWLEDGE_TOOLS,
} from './execute-nodia-ai-knowledge-tool.use-case.js';
import { eventJournalFixture } from '../../nodia-ai-run/event-journal.fixture.js';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { EntityManager } from 'typeorm';
import { ProcessNodiaAiStageUseCase } from './process-nodia-ai-stage.use-case.js';
import {
  BuildNodiaAiContextUseCase,
  isNodiaAiScopeVisible,
  type ContextHistoryItem,
} from './build-nodia-ai-context.use-case.js';
import { BuildNodiaAiCompactionUseCase } from './build-nodia-ai-compaction.use-case.js';
import type { NodiaAiContextSnapshotService } from '../../nodia-ai-context-snapshot/nodia-ai-context-snapshot.service.js';
import type { LoadNodiaAiContextHistoryUseCase } from '../../nodia-ai-context-snapshot/use-case/load-nodia-ai-context-history.use-case.js';
import type { LoadNodiaAiRecoveryRefsUseCase } from './load-nodia-ai-recovery-refs.use-case.js';
import {
  NODIA_AI_COMPACTION_BUILDER_VERSION,
  type NodiaAiCompactionSummary,
} from '../types/nodia-ai-compaction.types.js';
import type { LoadNodiaAiKnowledgeUseCase } from './load-nodia-ai-knowledge.use-case.js';
import type { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import {
  NodiaAiAdapterError,
  type NodiaAiAdapterPort,
  type NodiaAiAdapterRequest,
} from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
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
  invoiceOcr?: ProcessNodiaAiInvoiceOcrStageUseCase,
  generatedImages?: StoreNodiaAiGeneratedImageUseCase,
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
  const modules = ['/finance', '/nodia-ai'];
  const sourceScope = { schema_version: 1, module_routes: modules };
  const observation = {
    source: 'gemini_live_session_and_catalog' as const,
    adapterContractVersion: 'nodia-ai-gemini-chat/1' as const,
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
      routing_snapshot: {
        schema_version: 1,
        enabled: false,
        revision: 1,
        target: null,
      },
      deadline_at: new Date(Date.now() + 60000),
      selection_snapshot: {
        connection_id: '2',
        mode: 'agentic',
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
      if (
        sql.startsWith(
          'WITH changed AS (UPDATE nodia_ai_runs SET compactions_used=',
        )
      )
        return [{ id: claim.run.id }];
      if (sql.startsWith('SELECT (') && sql.endsWith(' AS bytes'))
        return [
          {
            bytes: String(
              (typeof parameters?.[0] === 'number'
                ? parameters[0] * 2
                : Buffer.byteLength(JSON.stringify(parameters?.[0]))) +
                Buffer.byteLength(JSON.stringify(parameters?.[1])),
            ),
          },
        ];
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
    engine: 'agentic' as const,
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
    measureContext: vi
      .fn()
      .mockImplementation(async (input: { canonicalPrompt: string }) => ({
        measurementContractVersion: 'nodia-ai-context-budget/1',
        measurementScope: 'initial_native_prompt',
        measurementKind: 'exact',
        canonicalUtf8Bytes: Buffer.byteLength(input.canonicalPrompt),
        catalogUtf8Bytes: 0,
        overheadUtf8Bytes: 128,
        totalUtf8Bytes: Buffer.byteLength(input.canonicalPrompt) + 128,
        firstMcpListingUpperBoundUtf8Bytes: 0,
        maxUtf8Bytes: 262144,
        modelContextTokens: null,
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
  const armDispatch = vi
    .fn<NodiaAiStageContext['armDispatch']>()
    .mockImplementation(async (_selection, _runtime, validate) => {
      events.push('arm');
      await validate?.(manager);
      return new Date(
        Math.min(
          claim.run.deadline_at.getTime(),
          Date.now() + policy.timing.provider_dispatch_seconds * 1000,
        ),
      );
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
    compactionProgress: vi
      .fn<ExecuteNodiaAiToolUseCase['compactionProgress']>()
      .mockResolvedValue(undefined),
  };
  const preferences = { loadForContext: vi.fn().mockResolvedValue([]) };
  const snapshots = {
    latest: vi
      .fn<NodiaAiContextSnapshotService['latest']>()
      .mockResolvedValue(null),
    insert: vi
      .fn<NodiaAiContextSnapshotService['insert']>()
      .mockImplementation(async (_manager, input) => ({
        id: 'd7d41d3e-f636-450e-89c5-65cc64f925ec',
        conversation_id: input.conversationId,
        revision: 1,
        through_message_seq: input.throughSeq,
        source_hash: input.sourceHash,
        summary: input.summary,
        scope_manifest: input.scopeManifest,
        builder_contract_version: input.builderContractVersion,
        created_at: new Date(),
      })),
  };
  const sourceHash = '9'.repeat(64);
  const historyReader = {
    fingerprint: vi
      .fn<LoadNodiaAiContextHistoryUseCase['fingerprint']>()
      .mockResolvedValue(sourceHash),
    load: vi
      .fn<LoadNodiaAiContextHistoryUseCase['load']>()
      .mockImplementation(async (_manager, input) => {
        const rows = (await query(
          'SELECT id,seq::text,role,author_id::text,source_scope_manifest',
          [input.conversationId, input.throughSeq],
        )) as {
          id: string;
          seq: string;
          role: string;
          author_id: string | null;
          source_scope_manifest: unknown;
        }[];
        const selected = rows.filter(
          (row) =>
            BigInt(row.seq) > BigInt(input.afterSeq ?? '0') &&
            BigInt(row.seq) <= BigInt(input.throughSeq),
        );
        const authorized = new Set(input.moduleRoutes);
        const ids = selected
          .filter(
            (row) =>
              isNodiaAiScopeVisible(row.source_scope_manifest, authorized) &&
              (row.role === 'assistant' || row.author_id === input.actorId),
          )
          .map((row) => row.id);
        const parts = ids.length
          ? ((await query('SELECT message_id,kind,text,attachment_id', [
              ids,
            ])) as {
              message_id: string;
              kind: string;
              text: string | null;
              attachment_id?: string | null;
            }[])
          : [];
        const history: ContextHistoryItem[] = selected.map((row) => ({
          seq: row.seq,
          role: row.role,
          scope: ids.includes(row.id) ? row.source_scope_manifest : null,
          parts: ids.includes(row.id)
            ? parts
                .filter((part) => part.message_id === row.id)
                .map((part) => ({
                  kind: part.kind,
                  text: part.text,
                  ...(part.attachment_id
                    ? { attachment_id: part.attachment_id }
                    : {}),
                }))
            : [],
        }));
        return {
          history,
          complete: true,
          throughSeq: selected.at(-1)?.seq ?? input.afterSeq ?? '0',
        };
      }),
  };
  const compaction = new BuildNodiaAiCompactionUseCase(policy);
  const recovery = {
    load: vi.fn<LoadNodiaAiRecoveryRefsUseCase['load']>().mockResolvedValue({
      schema_version: 1,
      pending_references: [],
      historical_references: [],
      historical_total: '0',
      historical_included: 0,
      historical_more: false,
    }),
  };
  const toolSelection = {
    verifySelection: vi
      .fn<(manager: EntityManager, claim: NodiaAiClaim) => Promise<void>>()
      .mockResolvedValue(undefined),
    activateSelection: vi
      .fn<NodiaAiToolSelectionFlowUseCase['activateSelection']>()
      .mockResolvedValue(undefined),
    discoveryIndex: vi
      .fn<
        (
          manager: EntityManager,
          claim: NodiaAiClaim,
        ) => Promise<Record<string, never> | undefined>
      >()
      .mockResolvedValue(undefined),
  };
  const cleanupProofs = {
    execute: vi
      .fn<CleanupNodiaAiRuntimeProofsUseCase['execute']>()
      .mockResolvedValue({ processed: 1, settled: 1 }),
  };
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
    invoiceOcr,
    generatedImages,
  );
  return {
    proof,
    tools,
    preferences,
    snapshots,
    historyReader,
    compaction,
    recovery,
    sourceHash,
    policy,
    toolSelection,
    cleanupProofs,
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

function applyCodexIdentity(f: ReturnType<typeof fixture>) {
  const adapterIdentity = {
    providerKey: 'openai' as const,
    contractVersion: 'nodia-ai-codex-chat/1' as const,
    connectionId: '2',
  };
  f.claim.run.selection_snapshot.mode = 'agentic';
  f.claim.attempt.id = '293a45fa-49ed-4641-93fd-106832bdd0b7';
  f.claim.attempt.worker_id = '293a45fa-49ed-4641-93fd-106832bdd0b8';
  f.claim.job.id = '293a45fa-49ed-4641-93fd-106832bdd0b9';
  Object.assign(f.observation, {
    source: 'codex_live_session_and_catalog',
    adapterContractVersion: 'nodia-ai-codex-chat/1',
    adapterIdentity,
    resourceKey: 'codex-profile:' + 'a'.repeat(64),
    supportsMcp: true,
  });
  f.claim.run.context_manifest.resource_key = f.observation.resourceKey;
  f.claim.run.context_manifest.adapter_identity = {
    provider_key: 'openai',
    contract_version: 'nodia-ai-codex-chat/1',
    connection_id: '2',
  };
  f.reservation.resourceKey = f.observation.resourceKey;
  f.reservation.operationRef = f.claim.attempt.id;
  Object.assign(f.proof, {
    engine: 'agentic',
    attemptId: f.claim.attempt.id,
    operationRef: f.claim.attempt.id,
    resourceKey: f.observation.resourceKey,
    adapterIdentity,
  });
  return f;
}

describe('Process NodiaAI stage', () => {
  function imageFixture() {
    const attachments = {
      usageForAdmission: vi.fn(async () => ({
        chat_bytes: '0',
        owner_bytes: '0',
      })),
      getInTransaction: vi.fn(async () => ({ state: 'ready' })),
    };
    const generatedImages = {
      execute: vi.fn(async () => ({
        attachment_id: 'private-generated-image',
      })),
    };
    const f = fixture(
      'inference',
      attachments as never,
      undefined,
      generatedImages as never,
    );
    f.claim.run.selection_snapshot.mode = 'agentic';
    Object.assign(f.proof, { engine: 'agentic' });
    f.historyReader.load.mockResolvedValue({
      history: [
        {
          seq: '2',
          role: 'user',
          scope: {
            schema_version: 1,
            module_routes: ['/finance', '/nodia-ai'],
          },
          parts: [{ kind: 'text', text: '/imagen una taza azul' }],
        },
      ],
      complete: true,
      throughSeq: '2',
    });
    return { ...f, generatedImages, attachments };
  }
  it.each([false, true])(
    'API image generation requires separate qualification=%s, not image-reading evidence',
    async (qualified) => {
      const f = imageFixture(),
        attemptId = 'f6861b77-a3ca-43d3-bd07-28c667f7e5ae';
      const identity = {
        providerKey: 'openai' as const,
        contractVersion: 'nodia-ai-api-chat/1' as const,
        connectionId: '2',
      };
      f.claim.attempt.id = attemptId;
      f.claim.run.selection_snapshot.mode = 'api_key';
      Object.assign(f.observation, {
        source: 'api_configuration_and_catalog',
        adapterContractVersion: identity.contractVersion,
        adapterIdentity: identity,
        resourceKey: 'api-connection:' + 'a'.repeat(64),
        supportsMcp: false,
        supportsTools: true,
        supportsImageGeneration: qualified,
        verifiedAttachmentMediaTypes: ['image/png'],
      });
      Object.assign(f.claim.run.context_manifest, {
        resource_key: f.observation.resourceKey,
        adapter_identity: {
          provider_key: identity.providerKey,
          contract_version: identity.contractVersion,
          connection_id: identity.connectionId,
        },
      });
      Object.assign(f.reservation, {
        resourceKey: f.observation.resourceKey,
        operationRef: attemptId,
      });
      const terminalProof = {
        engine: 'api_key' as const,
        attemptId,
        operationRef: attemptId,
        resourceKey: f.observation.resourceKey,
        sessionGeneration: f.observation.sessionGeneration,
        adapterIdentity: identity,
        terminalProofId: 'd54ca1c1-ac26-4a20-b5f5-f78251ed559a',
        localTransportClosed: true as const,
        remoteOutcome: 'completed' as const,
        outcome: 'completed' as const,
        observedAt: new Date(),
      };
      f.adapter.execute.mockResolvedValue({
        kind: 'answer',
        text: '',
        generatedImage: {
          contentBase64: 'synthetic',
          mediaType: 'image/png',
          sha256: 'a'.repeat(64),
        },
        terminalProof,
      });
      if (!qualified) {
        await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
          'modality_unavailable',
        );
        expect(f.reserve.execute).not.toHaveBeenCalled();
        expect(f.armDispatch).not.toHaveBeenCalled();
        expect(f.adapter.execute).not.toHaveBeenCalled();
      } else {
        const outcome = await f.subject.execute(f.claim, f.context);
        expect(outcome.status).toBe('completed');
        expect(f.adapter.execute.mock.calls[0][0]).toMatchObject({
          imageGeneration: { prompt: 'una taza azul' },
        });
        expect(f.adapter.execute.mock.calls[0][0].tools).toBeUndefined();
        expect(f.generatedImages.execute).toHaveBeenCalledOnce();
      }
    },
  );
  it('stores an image-only native answer and seals a private image part without demanding text', async () => {
    const f = imageFixture();
    const image = {
      contentBase64: 'synthetic-transport',
      mediaType: 'image/png' as const,
      sha256: 'a'.repeat(64),
    };
    f.adapter.execute.mockResolvedValue({
      kind: 'answer',
      text: '',
      generatedImage: image,
      terminalProof: f.proof,
    });
    const outcome = await f.subject.execute(f.claim, f.context);
    expect(outcome.status).toBe('completed');
    expect(f.adapter.execute.mock.calls[0][0]).toMatchObject({
      imageGeneration: { prompt: 'una taza azul' },
    });
    expect(f.adapter.execute.mock.calls[0][0].tools).toBeUndefined();
    expect(f.generatedImages.execute).toHaveBeenCalledExactlyOnceWith(
      f.claim.identity,
      f.claim.run.conversation_id,
      f.claim.run.id,
      image,
    );
    if (outcome.status === 'completed') await outcome.persist?.(f.manager);
    expect(
      f.query.mock.calls.find(([sql]) => sql.includes("'image',NULL"))?.[1],
    ).toEqual(expect.arrayContaining(['private-generated-image', 0]));
    expect(f.query.mock.calls.some(([sql]) => sql.includes("0,'text'"))).toBe(
      false,
    );
    expect(f.release.execute).toHaveBeenCalledOnce();
  });
  it('releases a completed native receipt after storage failure without another generation', async () => {
    const f = imageFixture();
    f.generatedImages.execute.mockRejectedValue(
      new Error('synthetic object store down'),
    );
    f.adapter.execute.mockResolvedValue({
      kind: 'answer',
      text: '',
      generatedImage: {
        contentBase64: 'synthetic',
        mediaType: 'image/png',
        sha256: 'a'.repeat(64),
      },
      terminalProof: f.proof,
    });
    const outcome = await f.subject.execute(f.claim, f.context);
    expect(outcome).toMatchObject({
      status: 'failed',
      errorCode: 'nodia_ai:generated_image_storage_unavailable',
      terminalProof: f.proof,
    });
    if (outcome.status === 'failed') await outcome.persist?.(f.manager);
    expect(f.adapter.execute).toHaveBeenCalledOnce();
    expect(f.release.execute).toHaveBeenCalledOnce();
  });
  it('does not publish an image part or sealed event when the stored attachment is no longer ready at SQL sealing', async () => {
    const f = imageFixture();
    f.attachments.getInTransaction.mockResolvedValueOnce({ state: 'expired' });
    f.adapter.execute.mockResolvedValue({
      kind: 'answer',
      text: '',
      generatedImage: {
        contentBase64: 'synthetic',
        mediaType: 'image/png',
        sha256: 'a'.repeat(64),
      },
      terminalProof: f.proof,
    });
    const outcome = await f.subject.execute(f.claim, f.context);
    expect(outcome.status).toBe('completed');
    if (outcome.status !== 'completed')
      throw new Error('expected staged completion');
    await expect(outcome.persist?.(f.manager)).rejects.toThrow(
      'attachment_not_ready',
    );
    expect(f.attachments.getInTransaction).toHaveBeenCalledWith(
      f.manager,
      f.claim.identity,
      'private-generated-image',
      f.claim.run.conversation_id,
    );
    expect(
      f.query.mock.calls.some(([sql]) => sql.includes("'image',NULL")),
    ).toBe(false);
    expect(
      f.query.mock.calls.some(([sql]) =>
        sql.includes('assistant_message_id=$2'),
      ),
    ).toBe(false);
    expect(f.adapter.execute).toHaveBeenCalledOnce();
  });
  it('does not bind private image bytes after read authority is revoked during sealing', async () => {
    const f = imageFixture();
    f.attachments.getInTransaction.mockRejectedValueOnce(
      new Error('synthetic revoked'),
    );
    f.adapter.execute.mockResolvedValue({
      kind: 'answer',
      text: '',
      generatedImage: {
        contentBase64: 'synthetic',
        mediaType: 'image/png',
        sha256: 'a'.repeat(64),
      },
      terminalProof: f.proof,
    });
    const outcome = await f.subject.execute(f.claim, f.context);
    if (outcome.status !== 'completed')
      throw new Error('expected staged completion');
    await expect(outcome.persist?.(f.manager)).rejects.toThrow(
      'synthetic revoked',
    );
    expect(
      f.query.mock.calls.some(([sql]) => sql.includes("'image',NULL")),
    ).toBe(false);
    expect(
      f.query.mock.calls.some(([sql]) =>
        sql.includes('assistant_message_id=$2'),
      ),
    ).toBe(false);
    expect(f.adapter.execute).toHaveBeenCalledOnce();
  });
  function ocrReferenceFixture(published = true) {
    const references = {
      schema_version: 1,
      references: [
        {
          analysis_id: 'private-preparation-id',
          business_id: 'private-business-id',
          attachment_id: 'private-attachment-id',
          source_message_seq: '1',
          provider_id: null,
          state_hint: 'awaiting_supplier',
        },
      ],
      more: false,
    };
    const ocr = {
      pending: vi.fn(async () => null),
      loadReferences: vi.fn(async () => references),
    };
    const f = fixture('inference', undefined, ocr as never);
    f.actor.modules.push({ route: '/business' });
    f.claim.run.context_manifest.module_routes = f.actor.modules.map(
      (m) => m.route,
    );
    Object.assign(f.knowledge.manifest, {
      capability_contracts: published
        ? [{ capability_id: 'nodia_invoices_ocr', publication: 'published' }]
        : [],
    });
    return { ...f, ocr, references };
  }
  it('recovers private OCR IDs into a later prompt without requiring the user to repeat a UUID', async () => {
    const f = ocrReferenceFixture();
    await f.subject.execute(f.claim, f.context);
    expect(f.ocr.loadReferences).toHaveBeenCalledWith(
      f.manager,
      expect.objectContaining({ modules: f.actor.modules }),
      f.claim.run.conversation_id,
      '2',
    );
    const prompt = f.adapter.execute.mock.calls[0][0].canonicalPrompt;
    expect(prompt).toContain('invoice_ocr_references');
    expect(prompt).toContain('private-preparation-id');
    expect(prompt).toContain('awaiting_supplier');
  });
  it('does not expose candidate OCR references before publication', async () => {
    const f = ocrReferenceFixture(false);
    await f.subject.execute(f.claim, f.context);
    expect(f.ocr.loadReferences).not.toHaveBeenCalled();
    expect(
      JSON.parse(f.adapter.execute.mock.calls[0][0].canonicalPrompt)
        .recovery_refs,
    ).not.toHaveProperty('invoice_ocr_references');
  });
  it('rejects changed OCR references at the fresh predispatch checkpoint', async () => {
    const f = ocrReferenceFixture();
    f.ocr.loadReferences
      .mockResolvedValueOnce(f.references)
      .mockResolvedValue({ schema_version: 1, references: [], more: false });
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'context_sources_changed',
    );
    expect(f.adapter.execute).not.toHaveBeenCalled();
    expect(f.reserve.execute).not.toHaveBeenCalled();
  });
  it('queues OCR only after the planner terminal proof, releasing its profile without an extra assistant generation', async () => {
    const pending = {
      schema_version: 1,
      analysis_id: 'fixture-analysis',
      request_id: 'fixture-request',
      source_attempt_id: 'fixture-planner',
    };
    const ocr = { pending: vi.fn(async () => pending), execute: vi.fn() };
    const f = fixture('inference', undefined, ocr as never);
    const result = await f.subject.execute(f.claim, f.context);
    expect(result).toMatchObject({
      status: 'continue',
      nextStage: 'invoice_ocr',
      terminalProof: f.proof,
    });
    expect(f.adapter.execute).toHaveBeenCalledOnce();
    expect(ocr.execute).not.toHaveBeenCalled();
    if (result.status === 'continue') await result.persist?.(f.manager);
    expect(f.release.execute).toHaveBeenCalledOnce();
    expect(f.claim.run.context_manifest.invoice_ocr_request).toEqual(pending);
    expect(
      f.query.mock.calls.some(([sql]) =>
        sql.startsWith('INSERT INTO nodia_ai_messages'),
      ),
    ).toBe(false);
  });
  it('routes the OCR stage without another planner adapter call', async () => {
    const ocr = {
      pending: vi.fn(),
      execute: vi.fn(async () => ({ status: 'completed' as const })),
    };
    const f = fixture('invoice_ocr', undefined, ocr as never);
    expect(await f.subject.execute(f.claim, f.context)).toEqual({
      status: 'completed',
    });
    expect(ocr.execute).toHaveBeenCalledExactlyOnceWith(f.claim, f.context);
    expect(f.adapter.observe).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
    expect(f.armDispatch).not.toHaveBeenCalled();
  });
  it('never starts OCR from an abandoned or unverified planner generation', async () => {
    const ocr = {
      pending: vi.fn(async () => ({ analysis_id: 'fixture' })),
      execute: vi.fn(),
    };
    const f = fixture('inference', undefined, ocr as never);
    Object.assign(f.proof, { outcome: 'abandoned_unknown' });
    expect(await f.subject.execute(f.claim, f.context)).toMatchObject({
      status: 'unknown',
    });
    expect(ocr.execute).not.toHaveBeenCalled();
    expect(f.release.execute).not.toHaveBeenCalled();
  });
  function codexFixture() {
    return applyCodexIdentity(fixture());
  }
  it('binds Codex observation identity before dispatch and routes callbacks through fenced checkpoints and the common gateway', async () => {
    const f = codexFixture(),
      signal = f.context.signal;
    const originalQuery = f.query.getMockImplementation()!;
    f.query.mockImplementation(async (sql, args) =>
      sql.startsWith('SELECT resource_key FROM nodia_ai_runtime_slots')
        ? [{ resource_key: f.observation.resourceKey }]
        : originalQuery(sql, args),
    );
    f.adapter.execute.mockImplementationOnce(
      async (request: NodiaAiAdapterRequest) => {
        await request.onLeaseCheck!(signal);
        await request.onProtocolProgress!(4, signal, 1);
        await request.onToolCall!(
          {
            callId: 'synthetic-callback',
            name: 'nodia_knowledge_index',
            arguments: {},
          },
          signal,
        );
        return {
          kind: 'answer',
          text: 'Respuesta sintética',
          terminalProof: f.proof,
        };
      },
    );
    const outcome = await f.subject.execute(f.claim, f.context);
    expect(outcome.status).toBe('completed');
    expect(f.armDispatch).toHaveBeenCalledWith(
      f.claim.run.selection_snapshot,
      {
        ...f.reservation,
        adapterIdentity: {
          providerKey: 'openai',
          contractVersion: 'nodia-ai-codex-chat/1',
          connectionId: '2',
        },
        sessionGeneration: f.observation.sessionGeneration,
      },
      expect.any(Function),
    );
    expect(f.tools.progress).toHaveBeenCalledExactlyOnceWith(
      f.claim,
      f.context,
      4,
      1,
    );
    expect(f.tools.execute).toHaveBeenCalledExactlyOnceWith(
      f.claim,
      f.context,
      {
        callId: 'synthetic-callback',
        name: 'nodia_knowledge_index',
        arguments: {},
      },
    );
    const slot = f.query.mock.calls.find(([sql]) =>
      sql.startsWith('SELECT resource_key FROM nodia_ai_runtime_slots'),
    )!;
    expect(slot[0]).toContain("state='held'");
    expect(slot[0]).toContain('FOR SHARE');
    expect(slot[1]).toEqual([
      f.reservation.resourceKey,
      f.claim.job.id,
      f.claim.attempt.worker_id,
      '8',
      f.claim.attempt.id,
    ]);
  });
  it('accounts every Codex protocol message even when no tools are attested and revokes callbacks after lease loss', async () => {
    const f = codexFixture();
    f.observation.supportsMcp = false;
    await f.subject.execute(f.claim, f.context);
    const request = f.adapter.execute.mock.calls[0][0] as NodiaAiAdapterRequest;
    expect(request.onToolCall).toBeUndefined();
    await request.onProtocolProgress!(7, f.context.signal, 2);
    expect(f.tools.progress).toHaveBeenCalledExactlyOnceWith(
      f.claim,
      f.context,
      7,
      2,
    );
    await expect(request.onLeaseCheck!(f.context.signal)).rejects.toThrow(
      'lease_lost',
    );
    const controller = new AbortController();
    controller.abort();
    await expect(
      request.onProtocolProgress!(8, controller.signal),
    ).rejects.toThrow('lease_lost');
    expect(f.tools.progress).toHaveBeenCalledTimes(1);
    expect(f.tools.execute).not.toHaveBeenCalled();
  });
  it.each([
    'manifest_missing',
    'manifest_connection',
    'observation_connection',
    'implicit_identity',
    'changed_contract',
  ])('does not reserve or dispatch Codex after %s', async (change) => {
    const f = codexFixture();
    if (change === 'manifest_missing')
      delete f.claim.run.context_manifest.adapter_identity;
    if (change === 'manifest_connection')
      (
        f.claim.run.context_manifest.adapter_identity as Record<string, string>
      ).connection_id = '4';
    if (change === 'observation_connection')
      Object.assign(f.observation, {
        adapterIdentity: {
          providerKey: 'openai',
          contractVersion: 'nodia-ai-codex-chat/1',
          connectionId: '4',
        },
      });
    if (change === 'implicit_identity') {
      Reflect.deleteProperty(f.observation, 'adapterIdentity');
      Reflect.deleteProperty(f.observation, 'adapterContractVersion');
    }
    if (change === 'changed_contract')
      Object.assign(f.observation, {
        adapterContractVersion: 'nodia-ai-gemini-chat/1',
      });
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'eligibility_changed',
    );
    expect(f.reserve.execute).not.toHaveBeenCalled();
    expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('classifies real observation contention before reserving or arming any dispatch', async () => {
    const f = codexFixture();
    const before = structuredClone(f.claim);
    f.adapter.observe.mockRejectedValueOnce(
      new NodiaAiAdapterError('runtime_busy', 'not_dispatched'),
    );
    await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject({
      errorCode: 'nodia_ai:runtime_busy',
      retryable: true,
    });
    expect(f.adapter.observe).toHaveBeenCalledTimes(1);
    expect(f.reserve.execute).not.toHaveBeenCalled();
    expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
    expect(f.claim).toEqual(before);
  });
  it.each(['unknown', 'other_code', 'duck_typed', 'cancelled'] as const)(
    'preserves %s observation failure without retry',
    async (kind) => {
      const f = codexFixture();
      const failure =
        kind === 'duck_typed'
          ? Object.assign(new Error('private_transport_secret'), {
              code: 'runtime_busy',
              outcome: 'not_dispatched',
            })
          : new NodiaAiAdapterError(
              kind === 'other_code'
                ? 'adapter_attachments_unverified'
                : 'runtime_busy',
              kind === 'unknown' ? 'unknown' : 'not_dispatched',
            );
      if (kind === 'cancelled') {
        const controller = new AbortController();
        controller.abort();
        f.context.signal = controller.signal;
      }
      f.adapter.observe.mockRejectedValueOnce(failure);
      await expect(f.subject.execute(f.claim, f.context)).rejects.toBe(failure);
      expect(f.adapter.observe).toHaveBeenCalledTimes(1);
      expect(f.reserve.execute).not.toHaveBeenCalled();
      expect(f.armDispatch).not.toHaveBeenCalled();
      expect(f.adapter.execute).not.toHaveBeenCalled();
    },
  );
  it.each(['not_dispatched', 'unknown'] as const)(
    'never normalizes or replays an execute %s error',
    async (outcome) => {
      const f = codexFixture();
      const failure = new NodiaAiAdapterError('runtime_busy', outcome);
      f.adapter.execute.mockRejectedValueOnce(failure);
      await expect(f.subject.execute(f.claim, f.context)).rejects.toBe(failure);
      expect(f.armDispatch).toHaveBeenCalledTimes(1);
      expect(f.adapter.execute).toHaveBeenCalledTimes(1);
      expect(f.adapter.observe).toHaveBeenCalledTimes(1);
    },
  );
  it('does not classify a busy-shaped measurement failure as observation contention', async () => {
    const f = codexFixture();
    const failure = new NodiaAiAdapterError('runtime_busy', 'not_dispatched');
    f.adapter.measureContext.mockRejectedValueOnce(failure);
    await expect(f.subject.execute(f.claim, f.context)).rejects.toBe(failure);
    expect(f.reserve.execute).not.toHaveBeenCalled();
    expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('marks only an exact direct Agentic observation timeout retryable before reserving or sending', async () => {
    const f = fixture();
    f.claim.run.selection_snapshot.mode = 'agentic';
    Object.assign(f.observation, {
      available: false,
      reason: 'agentic_timeout',
      adapterContractVersion: 'nodia-ai-gemini-chat/1',
    });
    const before = structuredClone(f.claim);
    await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject({
      errorCode: 'nodia_ai:agentic_observation_timeout',
      retryable: true,
    });
    expect(f.reserve.execute).not.toHaveBeenCalled();
    expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
    expect(f.claim).toEqual(before);
  });
  it.each([
    'resourceKey',
    'sessionGeneration',
    'configurationGeneration',
  ] as const)(
    'does not retry an observation timeout with changed %s',
    async (field) => {
      const f = fixture();
      f.claim.run.selection_snapshot.mode = 'agentic';
      Object.assign(f.observation, {
        available: false,
        reason: 'agentic_timeout',
        adapterContractVersion: 'nodia-ai-gemini-chat/1',
        [field]: 'changed',
      });
      await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject(
        {
          errorCode: 'nodia_ai:eligibility_changed',
          retryable: false,
        },
      );
      expect(f.reserve.execute).not.toHaveBeenCalled();
      expect(f.armDispatch).not.toHaveBeenCalled();
      expect(f.adapter.execute).not.toHaveBeenCalled();
    },
  );
  it.each([
    ['resourceKey', 'resource_key'],
    ['sessionGeneration', 'session_generation'],
    ['configurationGeneration', 'configuration_generation'],
  ])(
    'does not retry matching but empty %s identity',
    async (field, storedField) => {
      const f = fixture();
      f.claim.run.selection_snapshot.mode = 'agentic';
      f.claim.run.context_manifest[storedField] = '';
      Object.assign(f.observation, {
        available: false,
        reason: 'agentic_timeout',
        adapterContractVersion: 'nodia-ai-gemini-chat/1',
        [field]: '',
      });
      await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject(
        {
          errorCode: 'nodia_ai:eligibility_changed',
          retryable: false,
        },
      );
      expect(f.armDispatch).not.toHaveBeenCalled();
      expect(f.adapter.execute).not.toHaveBeenCalled();
    },
  );
  it.each([
    'agentic_unavailable',
    'session_required',
    'agentic_session_required',
    'model_unavailable',
    'model_option_mismatch',
    'adapter_protocol_unverified',
    'runtime_busy',
    null,
  ])(
    'does not retry generic or permanent observation reason %s',
    async (reason) => {
      const f = fixture();
      f.claim.run.selection_snapshot.mode = 'agentic';
      Object.assign(f.observation, {
        available: false,
        reason,
        adapterContractVersion: 'nodia-ai-gemini-chat/1',
      });
      await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject(
        {
          errorCode: 'nodia_ai:eligibility_changed',
          retryable: false,
        },
      );
      expect(f.reserve.execute).not.toHaveBeenCalled();
      expect(f.armDispatch).not.toHaveBeenCalled();
      expect(f.adapter.execute).not.toHaveBeenCalled();
    },
  );
  it.each(['token_plan_web', 'api_key'] as const)(
    'does not widen retries to mode %s',
    async (mode) => {
      const f = fixture();
      f.claim.run.selection_snapshot.mode = mode as never;
      Object.assign(f.observation, {
        available: false,
        reason: 'agentic_timeout',
        adapterContractVersion: 'nodia-ai-gemini-chat/1',
      });
      await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject(
        { retryable: false },
      );
      expect(f.armDispatch).not.toHaveBeenCalled();
      expect(f.adapter.execute).not.toHaveBeenCalled();
    },
  );
  it('does not treat a different adapter contract timeout as a Gemini observation timeout', async () => {
    const f = fixture();
    f.claim.run.selection_snapshot.mode = 'agentic';
    Object.assign(f.observation, {
      available: false,
      reason: 'agentic_timeout',
      adapterContractVersion: 'unreviewed',
    });
    await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject({
      retryable: false,
    });
    expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('does not retry observation timeout after cancellation or without a frozen resource match', async () => {
    for (const cancelled of [false, true]) {
      const f = fixture();
      f.claim.run.selection_snapshot.mode = 'agentic';
      Object.assign(f.observation, {
        available: false,
        reason: 'agentic_timeout',
        adapterContractVersion: 'nodia-ai-gemini-chat/1',
        ...(!cancelled ? { resourceKey: null } : {}),
      });
      if (cancelled) f.context.signal = AbortSignal.abort();
      await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject(
        { retryable: false },
      );
      expect(f.armDispatch).not.toHaveBeenCalled();
      expect(f.adapter.execute).not.toHaveBeenCalled();
    }
  });
  it('rejects a retired delegated stage before observation or reservation', async () => {
    const f = fixture('delegated_inference');
    await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject({
      errorCode: 'nodia_ai:mode_retired',
      retryable: false,
    });
    expect(f.adapter.observe).not.toHaveBeenCalled();
    expect(f.reserve.execute).not.toHaveBeenCalled();
    expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('revalidates the same direct selection after the observation recovers without fallback or a prior inference', async () => {
    const f = fixture();
    f.claim.run.selection_snapshot.mode = 'agentic';
    Object.assign(f.observation, {
      available: false,
      reason: 'agentic_timeout',
      adapterContractVersion: 'nodia-ai-gemini-chat/1',
    });
    const selection = structuredClone(f.claim.run.selection_snapshot);
    const deadline = f.claim.run.deadline_at.getTime();
    await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject({
      retryable: true,
    });
    expect(f.adapter.execute).not.toHaveBeenCalled();
    Object.assign(f.observation, { available: true, reason: null });
    await f.subject.execute(f.claim, f.context);
    expect(f.adapter.observe.mock.calls).toEqual([
      [selection, f.context.signal],
      [selection, f.context.signal],
    ]);
    expect(f.armDispatch).toHaveBeenCalledOnce();
    expect(f.adapter.execute).toHaveBeenCalledOnce();
    expect(f.adapter.execute).toHaveBeenCalledWith(
      expect.objectContaining({ selection }),
      f.context.signal,
    );
    expect(f.claim.run.deadline_at.getTime()).toBe(deadline);
  });
  it('passes the armed absolute provider deadline unchanged instead of renewing it after preparation', async () => {
    const f = fixture();
    const armedDeadline = new Date(Date.now() + 17000);
    f.armDispatch.mockResolvedValueOnce(armedDeadline);
    await f.subject.execute(f.claim, f.context);
    expect(f.adapter.execute).toHaveBeenCalledOnce();
    expect(f.adapter.execute).toHaveBeenCalledWith(
      expect.objectContaining({ deadlineAt: armedDeadline }),
      f.context.signal,
    );
  });
  const selectionAttemptId = 'a70f4bf2-899e-46a7-8d61-7b8323c28f1a';
  const selectionReceiptId = '089767bd-e595-45ce-8cb2-152012e35d73';
  function selectionState(phase: 'selection_requested' | 'ack_pending') {
    return {
      schema_version: 1,
      phase,
      catalog_hash: 'a'.repeat(64),
      request: {
        attempt_id: selectionAttemptId,
        tool_call_id: selectionReceiptId,
        capability_ids: ['fixture_capability'],
        profile: {
          schema_version: 1,
          profile_id: 'selected_capabilities',
          revision: 1,
          sha256: 'b'.repeat(64),
        },
        tool_contracts: Object.fromEntries(
          [
            'fixture_capability',
            ...Array.from({ length: 7 }, (_, i) => `technical_${i}`),
          ].map((name) => [name, 'c'.repeat(64)]),
        ),
      },
    };
  }
  it.each(['Respuesta sintética', ''])(
    'seals discovery with its terminal proof and text=%j without persisting an intermediate assistant answer or expanding the grant',
    async (text) => {
      const f = fixture();
      f.claim.attempt.id = selectionAttemptId;
      f.proof.attemptId = selectionAttemptId;
      f.claim.run.selection_snapshot.mode = 'agentic';
      f.observation.supportsMcp = true;
      f.claim.run.context_manifest.tool_selection = selectionState(
        'selection_requested',
      );
      f.adapter.execute.mockResolvedValue({
        kind: 'answer',
        text,
        terminalProof: f.proof,
      });
      const result = await f.subject.execute(f.claim, f.context);
      expect(result).toMatchObject({
        status: 'continue',
        nextStage: 'tool_selection',
        terminalProof: f.proof,
      });
      if ('persist' in result) await result.persist?.(f.manager);
      expect(f.release.execute).toHaveBeenCalledExactlyOnceWith(
        f.claim,
        f.reservation,
        f.proof,
        f.manager,
      );
      expect(f.claim.run.context_manifest.tool_selection).toMatchObject({
        phase: 'ack_pending',
      });
      expect(
        f.query.mock.calls.some(([sql]) =>
          sql.includes('INSERT INTO nodia_ai_messages'),
        ),
      ).toBe(false);
      expect(f.toolSelection.activateSelection).not.toHaveBeenCalled();
      expect(f.cleanupProofs.execute).not.toHaveBeenCalled();
    },
  );
  it('does not advance a selection belonging to another provider attempt', async () => {
    const f = fixture();
    f.claim.run.selection_snapshot.mode = 'agentic';
    f.observation.supportsMcp = true;
    f.claim.run.context_manifest.tool_selection = selectionState(
      'selection_requested',
    );
    expect(await f.subject.execute(f.claim, f.context)).toMatchObject({
      status: 'completed',
    });
    expect(f.toolSelection.activateSelection).not.toHaveBeenCalled();
  });
  it('cannot activate a discovery selection with a cancelled native proof, even if the adapter labels its text as an answer', async () => {
    const f = fixture();
    f.claim.attempt.id = selectionAttemptId;
    f.claim.run.selection_snapshot.mode = 'agentic';
    f.observation.supportsMcp = true;
    f.claim.run.context_manifest.tool_selection = selectionState(
      'selection_requested',
    );
    f.adapter.execute.mockResolvedValue({
      kind: 'answer',
      text: 'Contradictory synthetic reply',
      terminalProof: { ...f.proof, outcome: 'cancelled' },
    } as never);
    const outcome = await f.subject.execute(f.claim, f.context);
    expect(outcome).toEqual({
      status: 'unknown',
      errorCode: 'nodia_ai:invalid_provider_response',
    });
    expect(f.toolSelection.activateSelection).not.toHaveBeenCalled();
    expect(f.cleanupProofs.execute).not.toHaveBeenCalled();
    expect(f.release.execute).not.toHaveBeenCalled();
  });
  function activationFixture(delegated = false) {
    const f = fixture('tool_selection');
    f.claim.run.context_manifest.tool_selection = selectionState('ack_pending');
    const origin = {
      id: selectionAttemptId,
      job_id: f.claim.job.id,
      phase: 'completed',
      ended_at: new Date(),
      selection_snapshot: {
        ...f.claim.run.selection_snapshot,
        mode: 'agentic',
      },
      stage_key: delegated ? 'delegated_inference' : 'inference',
      routing_phase: delegated ? 'delegated' : 'base',
    };
    const repository = { findOneBy: vi.fn().mockResolvedValue(origin) };
    vi.mocked(f.manager.getRepository).mockImplementation(
      (entity) =>
        (entity === NodiaAiJobAttempt ? repository : f.runRepository) as never,
    );
    let ack = true;
    const original = f.query.getMockImplementation()!;
    f.query.mockImplementation(async (sql, args) =>
      sql === 'SELECT id FROM nodia_ai_jobs WHERE dedup_key=$1'
        ? ack
          ? [{ id: selectionReceiptId }]
          : []
        : original(sql, args),
    );
    f.cleanupProofs.execute.mockImplementation(async () => {
      ack = false;
      return { processed: 1, settled: 1 };
    });
    return { ...f, origin, repository };
  }
  it.each([false])(
    'acknowledges discovery outside SQL before activating the next generation, delegated=%s',
    async (delegated) => {
      const f = activationFixture(delegated);
      const outcome = await f.subject.execute(f.claim, f.context);
      expect(f.cleanupProofs.execute).toHaveBeenCalledExactlyOnceWith(
        selectionReceiptId,
      );
      expect(f.toolSelection.activateSelection).not.toHaveBeenCalled();
      expect(outcome).toMatchObject({
        status: 'continue',
        nextStage: delegated ? 'delegated_inference' : 'inference',
      });
      if ('persist' in outcome) await outcome.persist?.(f.manager);
      expect(f.toolSelection.activateSelection).toHaveBeenCalledExactlyOnceWith(
        f.manager,
        f.claim,
      );
      expect(f.adapter.observe).not.toHaveBeenCalled();
      expect(f.reserve.execute).not.toHaveBeenCalled();
      expect(f.armDispatch).not.toHaveBeenCalled();
      expect(f.adapter.execute).not.toHaveBeenCalled();
    },
  );
  it('leaves an unacknowledged discovery on bounded pre-dispatch retry without another inference', async () => {
    const f = activationFixture();
    f.cleanupProofs.execute.mockResolvedValue({ processed: 1, settled: 0 });
    await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject({
      errorCode: 'nodia_ai:tool_selection_ack_pending',
      retryable: true,
    });
    expect(f.toolSelection.activateSelection).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it.each(['catalog_changed', 'capability_denied'])(
    'rejects %s during activation preflight before scheduling another generation',
    async (code) => {
      const f = activationFixture();
      f.toolSelection.verifySelection.mockRejectedValue(
        new Error('nodia_ai:' + code),
      );
      await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject(
        { errorCode: 'nodia_ai:' + code, retryable: false },
      );
      expect(f.toolSelection.activateSelection).not.toHaveBeenCalled();
      expect(f.adapter.execute).not.toHaveBeenCalled();
      expect(f.armDispatch).not.toHaveBeenCalled();
    },
  );
  it.each(['unknown', 'dispatch_armed', 'failed'])(
    'cannot continue discovery whose source remains %s',
    async (phase) => {
      const f = activationFixture();
      f.origin.phase = phase;
      await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
        'tool_selection_invalid',
      );
      expect(f.cleanupProofs.execute).not.toHaveBeenCalled();
      expect(f.toolSelection.activateSelection).not.toHaveBeenCalled();
      expect(f.adapter.execute).not.toHaveBeenCalled();
    },
  );
  const memory: NodiaAiContextPreference = {
    id: '7708b6d1-4a3c-4c08-8ea3-c57a634aeb57',
    revision: 1,
    scope_key: 'finance',
    scope: {},
    key: 'expense_category_id',
    value: '17',
    value_label: 'Comida',
    scope_label: null,
  };
  it('sends current accepted preferences as data, persisting references instead of copied memory', async () => {
    const f = fixture();
    f.preferences.loadForContext.mockResolvedValue([memory]);
    await f.subject.execute(f.claim, f.context);
    expect(f.preferences.loadForContext).toHaveBeenCalledTimes(3);
    const request = (
      f.adapter.execute.mock.calls as unknown as [{ canonicalPrompt: string }][]
    )[0][0];
    expect(JSON.parse(request.canonicalPrompt).accepted_preferences).toEqual([
      memory,
    ]);
    expect(JSON.stringify(f.claim.run.context_manifest)).not.toContain(
      memory.value_label,
    );
    expect(f.adapter.execute).toHaveBeenCalledOnce();
  });
  it('stops before dispatch when the authorized discovery index changes after context assembly', async () => {
    const f = fixture();
    f.toolSelection.discoveryIndex
      .mockResolvedValueOnce({})
      .mockResolvedValue(undefined);
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'context_sources_changed',
    );
    expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('blocks without a profile reservation when accepted memory changes during provider observation', async () => {
    const f = fixture();
    f.preferences.loadForContext
      .mockResolvedValueOnce([memory])
      .mockResolvedValue([]);
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'preferences_changed',
    );
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
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'preferences_changed',
    );
    expect(f.armDispatch).toHaveBeenCalledOnce();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('does not reserve or dispatch when the ToolGateway rejects the MCP catalog envelope', async () => {
    const f = fixture();
    f.claim.run.selection_snapshot.mode = 'agentic';
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
  it('rejects an unexpected typed delegation response without another dispatch', async () => {
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
    expect(outcome).toMatchObject({
      status: 'failed',
      errorCode: 'nodia_ai:invalid_provider_response',
    });
    expect(f.tools.execute).not.toHaveBeenCalled();
    expect(f.adapter.execute).toHaveBeenCalledOnce();
  });
  it('rejects persisted delegation policy before any provider failure can occur', async () => {
    const f = fixture();
    f.claim.run.routing_snapshot = {
      schema_version: 1,
      enabled: true,
      revision: 2,
      target: null,
    };
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'nodia_ai:mode_retired',
    );
    expect(f.adapter.observe).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
    expect(f.reserve.execute).not.toHaveBeenCalled();
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
      '/nodia-ai',
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
  it('quarantines a malformed delegation result without terminal proof or assistant publication', async () => {
    const f = fixture();
    f.adapter.execute.mockResolvedValueOnce({
      kind: 'delegation_request',
      reason: 'Read data',
    });
    const outcome = await f.subject.execute(f.claim, f.context);
    expect(outcome).toMatchObject({
      status: 'unknown',
      errorCode: 'nodia_ai:invalid_provider_response',
    });
    expect(f.adapter.execute).toHaveBeenCalledOnce();
    expect(f.tools.execute).not.toHaveBeenCalled();
    expect(f.release.execute).not.toHaveBeenCalled();
    expect(f.journal.events).toHaveLength(0);
  });
});

describe('AI-34 compaction orchestration', () => {
  const compacted = (): NodiaAiCompactionSummary => ({
    schema_version: 1,
    facts: [],
    decisions: [],
    questions: [],
    entities: [],
    requirements: [
      { text: 'Necesito una reserva para Casa Faro.', source_seqs: ['1'] },
    ],
  });
  function longFixture(stage = 'context') {
    const attachments = {
      content: vi.fn(),
      usageForAdmission: vi
        .fn()
        .mockResolvedValue({ chat_bytes: '0', owner_bytes: '0' }),
    };
    const f = fixture(
      stage,
      attachments as unknown as ManageNodiaAiAttachmentUseCase,
    );
    const history: ContextHistoryItem[] = [
      {
        seq: '1',
        role: 'user',
        scope: {
          schema_version: 1,
          module_routes: ['/finance', '/nodia-ai'],
        },
        parts: [
          {
            kind: 'text',
            text:
              'Necesito una reserva para Casa Faro. ' +
              'Contenido sintético sin operaciones. '.repeat(4200),
          },
          { kind: 'audio', text: null, attachment_id: 'historical-audio' },
        ],
      },
      {
        seq: '2',
        role: 'user',
        scope: { schema_version: 1, module_routes: [] },
        parts: [{ kind: 'text', text: '¿Qué falta definir?' }],
      },
    ];
    f.historyReader.load.mockResolvedValue({
      history,
      complete: true,
      throughSeq: '2',
    });
    f.adapter.execute.mockResolvedValue({
      kind: 'answer',
      text: JSON.stringify(compacted()),
      terminalProof: f.proof,
    });
    return { ...f, attachments, history };
  }
  function storedSnapshot(f: ReturnType<typeof longFixture>) {
    return {
      id: 'd7d41d3e-f636-450e-89c5-65cc64f925ec',
      conversation_id: f.claim.run.conversation_id,
      revision: 1,
      through_message_seq: '1',
      source_hash: f.sourceHash,
      summary: compacted(),
      scope_manifest: {
        schema_version: 1,
        module_routes: ['/finance', '/nodia-ai'],
      },
      builder_contract_version: NODIA_AI_COMPACTION_BUILDER_VERSION,
      created_at: new Date(),
    };
  }
  function compactionProtocolFixture() {
    const f = longFixture();
    applyCodexIdentity(f);
    const t = toolFixture();
    const ledger = new ExecuteNodiaAiKnowledgeToolUseCase(
      t.knowledge,
      t.authorize as unknown as AuthorizeNodiaAiUseCase,
      f.policy,
    );
    const gateway = new ExecuteNodiaAiToolUseCase(
      t.registry,
      t.knowledge,
      ledger,
      t.discovery,
      t.authorize as unknown as AuthorizeNodiaAiUseCase,
      f.policy,
      t.selectionFlow,
    );
    f.tools.compactionProgress.mockImplementation(
      gateway.compactionProgress.bind(gateway),
    );
    f.tools.progress.mockImplementation(gateway.progress.bind(gateway));
    const original = f.query.getMockImplementation()!;
    let leaseValid = true;
    f.query.mockImplementation(async (sql, args) =>
      sql.startsWith('SELECT resource_key FROM nodia_ai_runtime_slots')
        ? leaseValid
          ? [{ resource_key: f.reservation.resourceKey }]
          : []
        : original(sql, args),
    );
    f.adapter.execute.mockImplementation(
      async (request: NodiaAiAdapterRequest) => {
        await request.onProtocolProgress!(0, f.context.signal, 0);
        return {
          kind: 'answer',
          text: JSON.stringify(compacted()),
          terminalProof: f.proof,
        };
      },
    );
    return {
      ...f,
      revokeLease: () => {
        leaseValid = false;
      },
    };
  }
  it('allows the native startup zero-RPC callback through the real context-only gateway and ledger', async () => {
    const f = compactionProtocolFixture();
    const outcome = await f.subject.execute(f.claim, f.context);
    expect(outcome).toMatchObject({
      status: 'continue',
      nextStage: 'inference',
      terminalProof: f.proof,
    });
    expect(f.tools.compactionProgress).toHaveBeenCalledExactlyOnceWith(
      f.claim,
      f.context,
      0,
      0,
    );
    expect(f.tools.progress).not.toHaveBeenCalled();
    expect(f.tools.execute).not.toHaveBeenCalled();
    const request = f.adapter.execute.mock.calls[0][0];
    expect(request.onToolCall).toBeUndefined();
    expect(request.tools).toBeUndefined();
    const leases = f.query.mock.calls.filter(([sql]) =>
      sql.startsWith('SELECT resource_key FROM nodia_ai_runtime_slots'),
    );
    expect(leases).toHaveLength(2);
    expect(
      leases.every(
        ([, args]) =>
          JSON.stringify(args) ===
          JSON.stringify([
            f.reservation.resourceKey,
            f.claim.job.id,
            f.claim.attempt.worker_id,
            '8',
            f.claim.attempt.id,
          ]),
      ),
    ).toBe(true);
    if ('persist' in outcome) await outcome.persist?.(f.manager);
    expect(f.snapshots.insert).toHaveBeenCalledOnce();
    await expect(f.tools.progress(f.claim, f.context, 0, 0)).rejects.toThrow(
      'capability_denied',
    );
  });
  it('rejects a lost compaction runtime lease before reporting startup', async () => {
    const f = compactionProtocolFixture();
    f.revokeLease();
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'nodia_ai:lease_lost',
    );
    expect(f.tools.compactionProgress).not.toHaveBeenCalled();
    expect(f.snapshots.insert).not.toHaveBeenCalled();
  });
  it('rechecks the runtime lease after the committed compaction progress checkpoint', async () => {
    const f = compactionProtocolFixture();
    const real = f.tools.compactionProgress.getMockImplementation()!;
    f.tools.compactionProgress.mockImplementation(async (...args) => {
      await real(...args);
      f.revokeLease();
    });
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'nodia_ai:lease_lost',
    );
    expect(f.tools.compactionProgress).toHaveBeenCalledOnce();
    expect(f.snapshots.insert).not.toHaveBeenCalled();
  });
  it('propagates fenced checkpoint revocation before forwarding compaction progress', async () => {
    const f = compactionProtocolFixture();
    const revoked = new Error('synthetic grant revoked by fenced checkpoint');
    f.adapter.execute.mockImplementation(
      async (request: NodiaAiAdapterRequest) => {
        f.checkpoint.mockRejectedValueOnce(revoked);
        await request.onProtocolProgress!(0, f.context.signal, 0);
        return {
          kind: 'answer',
          text: JSON.stringify(compacted()),
          terminalProof: f.proof,
        };
      },
    );
    await expect(f.subject.execute(f.claim, f.context)).rejects.toBe(revoked);
    expect(f.tools.compactionProgress).not.toHaveBeenCalled();
    expect(f.snapshots.insert).not.toHaveBeenCalled();
  });
  it.each(['before', 'after'] as const)(
    'honors callback cancellation %s the progress checkpoint',
    async (when) => {
      const f = compactionProtocolFixture();
      const controller = new AbortController();
      const real = f.tools.compactionProgress.getMockImplementation()!;
      if (when === 'after')
        f.tools.compactionProgress.mockImplementation(async (...args) => {
          await real(...args);
          controller.abort();
        });
      else controller.abort();
      f.adapter.execute.mockImplementation(
        async (request: NodiaAiAdapterRequest) => {
          await request.onProtocolProgress!(0, controller.signal, 0);
          return {
            kind: 'answer',
            text: JSON.stringify(compacted()),
            terminalProof: f.proof,
          };
        },
      );
      await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
        'nodia_ai:lease_lost',
      );
      expect(f.tools.compactionProgress).toHaveBeenCalledTimes(
        when === 'before' ? 0 : 1,
      );
      expect(f.snapshots.insert).not.toHaveBeenCalled();
    },
  );
  it.each([
    { provider: 'Gemini', transport: 'gemini_answer_envelope' },
    { provider: 'Codex', transport: 'plain_text' },
  ] as const)(
    'selects the explicit $provider compaction transport from the verified observation, not Agentic mode',
    async ({ provider, transport }) => {
      const f = longFixture();
      f.claim.run.selection_snapshot.mode = 'agentic';
      if (provider === 'Codex') applyCodexIdentity(f);
      const builder = vi.spyOn(f.compaction, 'execute');
      const outcome = await f.subject.execute(f.claim, f.context);
      expect(outcome).toMatchObject({
        status: 'continue',
        nextStage: 'inference',
        terminalProof: f.proof,
      });
      expect(builder).toHaveBeenCalledWith(
        expect.objectContaining({ throughSeq: '1' }),
        transport,
      );
      expect(f.adapter.observe.mock.invocationCallOrder[0]).toBeLessThan(
        builder.mock.invocationCallOrder[0],
      );
      const request = JSON.parse(
        f.adapter.execute.mock.calls[0][0].canonicalPrompt,
      );
      if (provider === 'Codex') {
        expect(request.instructions).not.toContain(
          'Cumple el envelope JSON del transporte con kind="answer"',
        );
        expect(request.instructions).toContain(
          'sin markdown, envelope kind/text ni texto externo',
        );
      } else
        expect(request.instructions).toContain(
          'Cumple el envelope JSON del transporte con kind="answer"',
        );
      if ('persist' in outcome) await outcome.persist?.(f.manager);
      expect(f.snapshots.insert).toHaveBeenCalledWith(
        f.manager,
        expect.objectContaining({ summary: compacted() }),
      );
      expect(f.adapter.execute).toHaveBeenCalledOnce();
    },
  );
  it('refuses an unknown observation source before building, reserving or dispatching compaction', async () => {
    const f = longFixture();
    Object.assign(f.observation, { source: 'future_unknown_adapter' });
    const builder = vi.spyOn(f.compaction, 'execute');
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'nodia_ai:eligibility_changed',
    );
    expect(builder).not.toHaveBeenCalled();
    expect(f.reserve.execute).not.toHaveBeenCalled();
    expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('classifies observation contention before reserving or charging compaction', async () => {
    const f = longFixture();
    f.adapter.observe.mockRejectedValueOnce(
      new NodiaAiAdapterError('runtime_busy', 'not_dispatched'),
    );
    await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject({
      errorCode: 'nodia_ai:runtime_busy',
      retryable: true,
    });
    expect(f.reserve.execute).not.toHaveBeenCalled();
    expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
    expect(
      f.query.mock.calls.some(([sql]) =>
        sql.startsWith(
          'WITH changed AS (UPDATE nodia_ai_runs SET compactions_used=',
        ),
      ),
    ).toBe(false);
  });
  it('retries the same direct Agentic observation timeout before reserving or charging compaction', async () => {
    const f = longFixture();
    f.claim.run.selection_snapshot.mode = 'agentic';
    Object.assign(f.observation, {
      available: false,
      reason: 'agentic_timeout',
      adapterContractVersion: 'nodia-ai-gemini-chat/1',
    });
    await expect(f.subject.execute(f.claim, f.context)).rejects.toMatchObject({
      errorCode: 'nodia_ai:agentic_observation_timeout',
      retryable: true,
    });
    expect(f.reserve.execute).not.toHaveBeenCalled();
    expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
    expect(
      f.query.mock.calls.some(([sql]) =>
        sql.startsWith(
          'WITH changed AS (UPDATE nodia_ai_runs SET compactions_used=',
        ),
      ),
    ).toBe(false);
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
    expect(outcome).toMatchObject({
      status: 'continue',
      terminalProof: f.proof,
    });
    expect(f.adapter.execute).toHaveBeenCalledOnce();
    expect(f.adapter.execute).toHaveBeenCalledWith(
      expect.objectContaining({ deadlineAt: armedDeadline }),
      f.context.signal,
    );
  });
  it('compacts when the native MCP catalog and wrapper overflow even though canonical history is below the trigger', async () => {
    const f = longFixture();
    f.history[0].parts = [
      {
        kind: 'text',
        text: 'Necesito una reserva para Casa Faro. ' + 'Datos. '.repeat(5000),
      },
    ];
    f.claim.run.selection_snapshot.mode = 'agentic';
    f.observation.supportsMcp = true;
    const original = f.adapter.measureContext.getMockImplementation()!;
    f.adapter.measureContext.mockImplementation(async (input) => {
      const measured = await original(input);
      return input.canonicalPrompt.includes('"task":"compact_conversation"')
        ? measured
        : {
            ...measured,
            catalogUtf8Bytes: 240000,
            totalUtf8Bytes: measured.totalUtf8Bytes + 240000,
          };
    });
    expect(await f.subject.execute(f.claim, f.context)).toMatchObject({
      status: 'continue',
      terminalProof: f.proof,
    });
    expect(f.adapter.measureContext).toHaveBeenCalledTimes(2);
    expect(f.adapter.measureContext.mock.calls[0][0]).toHaveProperty('tools');
    expect(f.adapter.measureContext.mock.calls[1][0]).not.toHaveProperty(
      'tools',
    );
    expect(
      JSON.parse(f.adapter.execute.mock.calls[0][0].canonicalPrompt).task,
    ).toBe('compact_conversation');
  });
  it('rejects an oversized inference envelope before reserving or arming, without a second compaction', async () => {
    const f = longFixture('inference');
    const original = f.adapter.measureContext.getMockImplementation()!;
    f.adapter.measureContext.mockImplementation(async (input) => ({
      ...(await original(input)),
      totalUtf8Bytes: 262145,
    }));
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'nodia_ai:context_limit',
    );
    expect(f.reserve.execute).not.toHaveBeenCalled();
    expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
    expect(f.snapshots.insert).not.toHaveBeenCalled();
  });
  it('reserves the duplicated first MCP listing before deciding whether context requires compaction', async () => {
    const f = longFixture();
    f.history[0].parts = [
      {
        kind: 'text',
        text: 'Necesito una reserva para Casa Faro. ' + 'Datos. '.repeat(5000),
      },
    ];
    f.claim.run.selection_snapshot.mode = 'agentic';
    f.observation.supportsMcp = true;
    const original = f.adapter.measureContext.getMockImplementation()!;
    f.adapter.measureContext.mockImplementation(async (input) => {
      const measured = await original(input);
      return input.canonicalPrompt.includes('"task":"compact_conversation"')
        ? measured
        : {
            ...measured,
            totalUtf8Bytes: 200000,
            firstMcpListingUpperBoundUtf8Bytes: 70000,
          };
    });
    expect(await f.subject.execute(f.claim, f.context)).toMatchObject({
      status: 'continue',
      terminalProof: f.proof,
    });
    expect(f.adapter.execute).toHaveBeenCalledOnce();
    expect(
      JSON.parse(f.adapter.execute.mock.calls[0][0].canonicalPrompt).task,
    ).toBe('compact_conversation');
  });
  it('cannot dispatch when the initial prompt fits but its first MCP listing cannot fit', async () => {
    const f = fixture('inference');
    const original = f.adapter.measureContext.getMockImplementation()!;
    f.adapter.measureContext.mockImplementation(async (input) => ({
      ...(await original(input)),
      totalUtf8Bytes: 262144,
      firstMcpListingUpperBoundUtf8Bytes: 1,
    }));
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'nodia_ai:context_limit',
    );
    expect(f.reserve.execute).not.toHaveBeenCalled();
    expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('rejects an oversized compaction envelope without spending its durable budget', async () => {
    const f = longFixture();
    const original = f.adapter.measureContext.getMockImplementation()!;
    f.adapter.measureContext.mockImplementation(async (input) => ({
      ...(await original(input)),
      totalUtf8Bytes: 262145,
    }));
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'nodia_ai:context_limit',
    );
    expect(f.reserve.execute).not.toHaveBeenCalled();
    expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('fails a measurement outage before inference and never retries or changes the selection', async () => {
    const f = fixture('inference');
    const selection = { ...f.claim.run.selection_snapshot };
    f.adapter.measureContext.mockRejectedValueOnce(
      new Error('private measurement unavailable'),
    );
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'private measurement unavailable',
    );
    expect(f.adapter.measureContext).toHaveBeenCalledOnce();
    expect(f.reserve.execute).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
    expect(f.claim.run.selection_snapshot).toEqual(selection);
  });
  it.each(['agentic', 'agentic'] as const)(
    'compacts long context with the exact %s selection, no tools/files and an atomic durable counter',
    async (mode) => {
      const f = longFixture();
      f.claim.run.selection_snapshot.mode = mode as never;
      f.observation.supportsMcp = mode === 'agentic';
      const outcome = await f.subject.execute(f.claim, f.context);
      expect(outcome).toMatchObject({
        status: 'continue',
        nextStage: 'inference',
        terminalProof: f.proof,
      });
      expect(f.adapter.execute).toHaveBeenCalledOnce();
      const request = f.adapter.execute.mock.calls[0][0];
      expect(request.selection).toEqual(f.claim.run.selection_snapshot);
      expect(JSON.parse(request.canonicalPrompt)).toMatchObject({
        task: 'compact_conversation',
        through_seq: '1',
      });
      expect(request).not.toHaveProperty('tools');
      expect(request).not.toHaveProperty('onToolCall');
      expect(request).not.toHaveProperty('attachments');
      expect(f.attachments.content).not.toHaveBeenCalled();
      expect(f.tools.descriptors).toHaveBeenCalledTimes(
        mode === 'agentic' ? 1 : 0,
      );
      const reservationIndex = f.query.mock.calls.findIndex(([sql]) =>
        sql.startsWith(
          'WITH changed AS (UPDATE nodia_ai_runs SET compactions_used=',
        ),
      );
      expect(reservationIndex).toBeGreaterThan(-1);
      expect(f.query.mock.calls[reservationIndex][1]).toEqual([
        f.claim.run.id,
        f.policy.budget.compactions_per_run,
      ]);
      expect(f.query.mock.invocationCallOrder[reservationIndex]).toBeLessThan(
        f.adapter.execute.mock.invocationCallOrder[0],
      );
      expect(f.snapshots.insert).not.toHaveBeenCalled();
      expect(f.release.execute).not.toHaveBeenCalled();
      if (!('persist' in outcome))
        throw new Error('Expected durable compaction');
      await outcome.persist?.(f.manager);
      expect(f.snapshots.insert).toHaveBeenCalledWith(
        f.manager,
        expect.objectContaining({
          conversationId: f.claim.run.conversation_id,
          throughSeq: '1',
          sourceHash: f.sourceHash,
          summary: compacted(),
          builderContractVersion: NODIA_AI_COMPACTION_BUILDER_VERSION,
        }),
      );
      expect(f.attachments.usageForAdmission).toHaveBeenLastCalledWith(
        f.manager,
        f.claim.run.conversation_id,
        f.claim.identity.userId,
        expect.any(Date),
        f.claim.run.id,
      );
      expect(f.claim.run.context_snapshot_id).toBe(
        'd7d41d3e-f636-450e-89c5-65cc64f925ec',
      );
      expect(f.claim.run.context_manifest.compaction).toMatchObject({
        through_seq: '1',
        mode,
        model_id: 'fixture-model',
      });
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
      ).toBe(false);
    },
  );
  it('fails invalid model JSON with its completed terminal proof, releases the profile and never overwrites history/snapshot', async () => {
    const f = longFixture();
    f.adapter.execute.mockResolvedValueOnce({
      kind: 'answer',
      text: '{broken',
      terminalProof: f.proof,
    });
    const outcome = await f.subject.execute(f.claim, f.context);
    expect(outcome).toMatchObject({
      status: 'failed',
      errorCode: 'nodia_ai:compaction_invalid',
      terminalProof: f.proof,
    });
    if ('persist' in outcome) await outcome.persist?.(f.manager);
    expect(f.release.execute).toHaveBeenCalledWith(
      f.claim,
      f.reservation,
      f.proof,
      f.manager,
    );
    expect(f.snapshots.insert).not.toHaveBeenCalled();
    expect(f.claim.run.context_snapshot_id).toBeUndefined();
    expect(
      f.query.mock.calls.some(([sql]) =>
        /(?:INSERT INTO|UPDATE) nodia_ai_message/.test(sql),
      ),
    ).toBe(false);
  });
  it.each(['observe', 'reservation'] as const)(
    'rejects changed history after %s before sending the compaction',
    async (phase) => {
      const f = longFixture();
      if (phase === 'observe')
        f.adapter.observe.mockImplementationOnce(async () => {
          f.historyReader.fingerprint.mockResolvedValue('8'.repeat(64));
          return f.observation;
        });
      else
        f.reserve.execute.mockImplementationOnce(async () => {
          f.historyReader.fingerprint.mockResolvedValue('8'.repeat(64));
          return f.reservation;
        });
      await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
        'nodia_ai:context_sources_changed',
      );
      expect(f.adapter.execute).not.toHaveBeenCalled();
      expect(f.snapshots.insert).not.toHaveBeenCalled();
      expect(
        f.query.mock.calls.some(([sql]) =>
          sql.startsWith(
            'WITH changed AS (UPDATE nodia_ai_runs SET compactions_used=',
          ),
        ),
      ).toBe(false);
    },
  );
  it('returns a known terminal failure when sources change after the provider response', async () => {
    const f = longFixture();
    f.adapter.execute.mockImplementationOnce(async () => {
      f.historyReader.fingerprint.mockResolvedValue('8'.repeat(64));
      return {
        kind: 'answer',
        text: JSON.stringify(compacted()),
        terminalProof: f.proof,
      };
    });
    const outcome = await f.subject.execute(f.claim, f.context);
    expect(outcome).toMatchObject({
      status: 'failed',
      errorCode: 'nodia_ai:context_sources_changed',
      terminalProof: f.proof,
    });
    if ('persist' in outcome) await outcome.persist?.(f.manager);
    expect(f.release.execute).toHaveBeenCalledOnce();
    expect(f.snapshots.insert).not.toHaveBeenCalled();
  });
  it('rechecks original sources again inside the persistence transaction', async () => {
    const f = longFixture();
    const outcome = await f.subject.execute(f.claim, f.context);
    f.historyReader.fingerprint.mockResolvedValue('8'.repeat(64));
    if (!('persist' in outcome) || !outcome.persist)
      throw new Error('Expected persist');
    await expect(outcome.persist(f.manager)).rejects.toThrow(
      'nodia_ai:context_sources_changed',
    );
    expect(f.snapshots.insert).not.toHaveBeenCalled();
    expect(f.release.execute).not.toHaveBeenCalled();
  });
  it('rejects exhausted compaction budget inside arming without a provider send', async () => {
    const f = longFixture();
    const original = f.query.getMockImplementation()!;
    f.query.mockImplementation(async (sql, args) =>
      sql.startsWith(
        'WITH changed AS (UPDATE nodia_ai_runs SET compactions_used=',
      )
        ? []
        : original(sql, args),
    );
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'nodia_ai:execution_limit',
    );
    expect(f.adapter.execute).not.toHaveBeenCalled();
    expect(f.snapshots.insert).not.toHaveBeenCalled();
  });
  it.each(['chat_bytes', 'owner_bytes'] as const)(
    'rejects insufficient %s for a snapshot reservation before consuming budget or sending',
    async (field) => {
      const f = longFixture();
      f.attachments.usageForAdmission.mockResolvedValue({
        chat_bytes: '0',
        owner_bytes: '0',
        [field]: String(
          field === 'chat_bytes'
            ? f.policy.admission.chat_storage_bytes
            : f.policy.admission.owner_storage_bytes,
        ),
      });
      await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
        'nodia_ai:storage_limit',
      );
      expect(
        f.query.mock.calls.some(([sql]) =>
          sql.startsWith(
            'WITH changed AS (UPDATE nodia_ai_runs SET compactions_used=',
          ),
        ),
      ).toBe(false);
      expect(f.adapter.execute).not.toHaveBeenCalled();
      expect(f.snapshots.insert).not.toHaveBeenCalled();
    },
  );
  it('rejects a typed delegation result from direct Agentic without executing tools or another inference', async () => {
    const f = fixture();
    f.adapter.execute.mockResolvedValue({
      kind: 'delegation_request',
      reason: 'synthetic request',
      terminalProof: f.proof,
    } as never);
    const result = await f.subject.execute(f.claim, f.context);
    expect(result).toMatchObject({
      status: 'failed',
      errorCode: 'nodia_ai:invalid_provider_response',
    });
    expect(f.adapter.execute).toHaveBeenCalledOnce();
    expect(f.tools.execute).not.toHaveBeenCalled();
    if ('persist' in result) await result.persist?.(f.manager);
    expect(f.release.execute).toHaveBeenCalledExactlyOnceWith(
      f.claim,
      f.reservation,
      f.proof,
      f.manager,
    );
  });
  it('reuses a valid snapshot with only its bounded tail when the configured mode/model changes', async () => {
    const f = longFixture('inference');
    f.snapshots.latest.mockResolvedValue(storedSnapshot(f));
    f.historyReader.load.mockImplementation(async (_manager, input) => {
      expect(input.afterSeq).toBe('1');
      expect(input.maxBytes).toBe(
        Math.floor((f.policy.results.assembled_context_utf8_bytes * 3) / 4),
      );
      return { history: [f.history[1]], throughSeq: '2', complete: true };
    });
    f.claim.run.selection_snapshot.model_id = 'another-configured-model';
    f.claim.run.selection_snapshot.mode = 'agentic';
    f.observation.supportsMcp = true;
    await f.subject.execute(f.claim, f.context);
    const request = f.adapter.execute.mock.calls[0][0];
    const prompt = JSON.parse(request.canonicalPrompt);
    expect(request.selection).toEqual(f.claim.run.selection_snapshot);
    expect(prompt.conversation_memory).toEqual(compacted());
    expect(prompt.messages).toEqual([
      { role: 'user', content: '¿Qué falta definir?' },
    ]);
    expect(f.snapshots.insert).not.toHaveBeenCalled();
    expect(
      f.query.mock.calls.some(([sql]) =>
        sql.startsWith(
          'WITH changed AS (UPDATE nodia_ai_runs SET compactions_used=',
        ),
      ),
    ).toBe(false);
  });
  it.each(['scope', 'hash'] as const)(
    'discards a snapshot with changed %s and rebuilds original authorized history',
    async (kind) => {
      const f = longFixture('inference');
      const stored = storedSnapshot(f);
      if (kind === 'scope') stored.scope_manifest.module_routes = ['/revoked'];
      else stored.source_hash = 'e'.repeat(64);
      f.snapshots.latest.mockResolvedValue(stored);
      f.historyReader.load.mockResolvedValue({
        history: [f.history[1]],
        complete: true,
        throughSeq: '2',
      });
      await f.subject.execute(f.claim, f.context);
      expect(f.historyReader.load).toHaveBeenCalledWith(
        f.manager,
        expect.objectContaining({ afterSeq: '0' }),
      );
      expect(
        JSON.parse(f.adapter.execute.mock.calls[0][0].canonicalPrompt),
      ).not.toHaveProperty('conversation_memory');
    },
  );
  it('blocks inference on a partial raw window instead of silently treating it as full history', async () => {
    const f = longFixture('inference');
    f.historyReader.load.mockResolvedValue({
      history: [f.history[0]],
      complete: false,
      throughSeq: '1',
    });
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'nodia_ai:context_limit',
    );
    expect(f.adapter.execute).not.toHaveBeenCalled();
    expect(f.reserve.execute).not.toHaveBeenCalled();
  });
  it('treats a changed live receipt/proposal as a source change instead of trusting its historical quote', async () => {
    const f = longFixture();
    f.adapter.execute.mockImplementationOnce(async () => {
      f.recovery.load.mockResolvedValue({
        schema_version: 1,
        pending_references: [
          { kind: 'restricted', reference_kind: 'execution', id: 'changed' },
        ],
        historical_references: [],
        historical_total: '0',
        historical_included: 0,
        historical_more: false,
      });
      return {
        kind: 'answer',
        text: JSON.stringify(compacted()),
        terminalProof: f.proof,
      };
    });
    const outcome = await f.subject.execute(f.claim, f.context);
    expect(outcome).toMatchObject({
      status: 'failed',
      errorCode: 'nodia_ai:context_sources_changed',
    });
    expect(f.snapshots.insert).not.toHaveBeenCalled();
  });
});

describe('AI-32 native attachment dispatch fences', () => {
  function nativeFixture(
    proved = true,
    kind: 'pdf' | 'image' | 'audio' = 'pdf',
  ) {
    const mime = {
      pdf: 'application/pdf',
      image: 'image/png',
      audio: 'audio/wav',
    }[kind];
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
    Object.assign(f.observation, {
      verifiedModalities: proved ? [kind] : [],
      verifiedAttachmentMediaTypes: proved ? [mime] : [],
    });
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
  it('carries an accepted Codex image through context measurement, persistence and fenced inference with its exact MIME', async () => {
    const f = nativeFixture(true, 'image');
    applyCodexIdentity(f);
    const native = new CodexChatRuntime({} as CodexRuntimeService);
    f.adapter.measureContext.mockImplementation(
      async (input: Parameters<NodiaAiAdapterPort['measureContext']>[0]) => ({
        ...native.measure({
          modelId: input.selection.model_id,
          prompt: input.canonicalPrompt,
          tools: input.tools ?? [],
          images: input.attachments?.map((ref) =>
            ref.media_type ? { mediaType: ref.media_type as 'image/png' } : {},
          ),
        }),
        measurementContractVersion: 'nodia-ai-context-budget/1',
        measurementScope: 'initial_native_prompt',
        modelContextTokens: null,
        firstMcpListingUpperBoundUtf8Bytes: 0,
      }),
    );
    f.claim.job.stage_key = 'context';
    const assembled = await f.subject.execute(f.claim, f.context);
    expect(assembled).toMatchObject({
      status: 'continue',
      nextStage: 'inference',
    });
    expect(f.adapter.measureContext).toHaveBeenCalledWith(
      expect.objectContaining({ attachments: [{ kind: 'image' }] }),
      f.context.signal,
    );
    expect(f.attachments.content).not.toHaveBeenCalled();
    expect(f.armDispatch).not.toHaveBeenCalled();
    if (assembled.status !== 'continue')
      throw Error('Expected context persistence');
    await assembled.persist!(f.manager);
    f.claim.job.stage_key = 'inference';
    expect(await f.subject.execute(f.claim, f.context)).toMatchObject({
      status: 'completed',
    });
    expect(f.adapter.measureContext).toHaveBeenLastCalledWith(
      expect.objectContaining({
        attachments: [{ kind: 'image', media_type: 'image/png' }],
      }),
      f.context.signal,
    );
    expect(f.adapter.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            kind: 'image',
            media_type: 'image/png',
            sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          }),
        ],
      }),
      f.context.signal,
    );
    expect(f.attachments.content.mock.invocationCallOrder[0]).toBeLessThan(
      f.armDispatch.mock.invocationCallOrder[0],
    );
  });
  it('preserves a proved Codex WAV through context and fenced dispatch without a reviewed transcription', async () => {
    const f = nativeFixture(true, 'audio');
    applyCodexIdentity(f);
    f.claim.job.stage_key = 'context';
    const assembled = await f.subject.execute(f.claim, f.context);
    expect(assembled).toMatchObject({
      status: 'continue',
      nextStage: 'inference',
    });
    expect(f.adapter.measureContext).toHaveBeenCalledWith(
      expect.objectContaining({ attachments: [{ kind: 'audio' }] }),
      f.context.signal,
    );
    expect(f.attachments.content).not.toHaveBeenCalled();
    expect(f.armDispatch).not.toHaveBeenCalled();
    if (assembled.status !== 'continue')
      throw Error('Expected context persistence');
    await assembled.persist!(f.manager);
    f.claim.job.stage_key = 'inference';
    expect(await f.subject.execute(f.claim, f.context)).toMatchObject({
      status: 'completed',
    });
    expect(f.adapter.measureContext).toHaveBeenLastCalledWith(
      expect.objectContaining({
        attachments: [{ kind: 'audio', media_type: 'audio/wav' }],
      }),
      f.context.signal,
    );
    expect(f.adapter.execute).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        attachments: [
          {
            kind: 'audio',
            media_type: 'audio/wav',
            sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
            content_base64: Buffer.from('synthetic decoded document').toString(
              'base64',
            ),
          },
        ],
      }),
      f.context.signal,
    );
    expect(f.attachments.content.mock.invocationCallOrder[0]).toBeLessThan(
      f.armDispatch.mock.invocationCallOrder[0],
    );
    expect(f.claim.run.context_manifest.stage_contexts).toHaveProperty(
      f.claim.attempt.id,
    );
  });
  it.each(['no_proof', 'category_only', 'unreviewed_pdf'] as const)(
    'blocks unproved Codex originals before I/O: %s',
    async (reason) => {
      const f = nativeFixture(
        false,
        reason === 'unreviewed_pdf' ? 'pdf' : 'audio',
      );
      applyCodexIdentity(f);
      if (reason === 'category_only')
        Object.assign(f.observation, { verifiedModalities: ['audio'] });
      await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
        'nodia_ai:modality_unavailable',
      );
      expect(f.attachments.content).not.toHaveBeenCalled();
      expect(f.reserve.execute).not.toHaveBeenCalled();
      expect(f.armDispatch).not.toHaveBeenCalled();
      expect(f.adapter.execute).not.toHaveBeenCalled();
    },
  );
  it('revalidates the Codex WAV proof after context rather than inheriting its earlier acceptance', async () => {
    const f = nativeFixture(true, 'audio');
    applyCodexIdentity(f);
    f.claim.job.stage_key = 'context';
    const assembled = await f.subject.execute(f.claim, f.context);
    if (assembled.status !== 'continue')
      throw Error('Expected context persistence');
    await assembled.persist!(f.manager);
    f.claim.job.stage_key = 'inference';
    Object.assign(f.observation, {
      verifiedAttachmentMediaTypes: [],
      verifiedModalities: ['audio'],
    });
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'nodia_ai:modality_unavailable',
    );
    expect(f.attachments.content).not.toHaveBeenCalled();
    expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('never arms Codex WAV when authority is revoked after reading the private original', async () => {
    const f = nativeFixture(true, 'audio');
    applyCodexIdentity(f);
    f.attachments.content.mockImplementation(async () => {
      f.authorize.execute.mockRejectedValueOnce(
        new Error('revoked after audio read'),
      );
      return {
        buffer: Buffer.from('synthetic decoded document'),
        media_type: 'audio/wav',
        file_name: 'synthetic.wav',
      };
    });
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'revoked after audio read',
    );
    expect(f.attachments.content).toHaveBeenCalledTimes(1);
    expect(f.reserve.execute).not.toHaveBeenCalled();
    expect(f.armDispatch).not.toHaveBeenCalled();
    expect(f.adapter.execute).not.toHaveBeenCalled();
  });
  it('passes a reviewed PDF to Codex as text without claiming or reading a native PDF', async () => {
    const f = nativeFixture(false, 'pdf');
    applyCodexIdentity(f);
    const previous = f.query.getMockImplementation()!;
    f.query.mockImplementation(async (sql: string, parameters?: unknown[]) =>
      sql.startsWith('SELECT message_id,kind,text')
        ? [
            {
              message_id: 'own',
              kind: 'pdf',
              text: 'Texto del PDF extraído y revisado explícitamente.',
              attachment_id: 'fixture-attachment',
            },
          ]
        : previous(sql, parameters),
    );
    expect(await f.subject.execute(f.claim, f.context)).toMatchObject({
      status: 'completed',
    });
    expect(f.attachments.content).not.toHaveBeenCalled();
    const request = f.adapter.execute.mock.calls[0][0] as NodiaAiAdapterRequest;
    expect(request.attachments).toBeUndefined();
    expect(request.canonicalPrompt).toContain(
      'Texto del PDF extraído y revisado explícitamente.',
    );
    expect(f.adapter.measureContext).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ attachments: expect.anything() }),
      f.context.signal,
    );
  });
  it('does not dispatch a Codex original after its exact MIME proof disappears between context and inference', async () => {
    const f = nativeFixture(false, 'image');
    applyCodexIdentity(f);
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'modality_unavailable',
    );
    expect(f.attachments.content).not.toHaveBeenCalled();
    expect(f.armDispatch).not.toHaveBeenCalled();
  });
  it('blocks a different MIME in the same kind before arming inference', async () => {
    for (const [kind, mime] of [
      ['image', 'image/jpeg'],
      ['audio', 'audio/webm'],
    ] as const) {
      const f = nativeFixture(true, kind);
      f.attachments.content.mockResolvedValue({
        buffer: Buffer.from('synthetic same-kind file'),
        media_type: mime,
        file_name: 'synthetic-file',
      });
      await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
        'nodia_ai:modality_unavailable',
      );
      expect(f.attachments.content).toHaveBeenCalledOnce();
      expect(f.reserve.execute).not.toHaveBeenCalled();
      expect(f.context.armDispatch).not.toHaveBeenCalled();
      expect(f.adapter.execute).not.toHaveBeenCalled();
    }
  });
  it('does not use a legacy category summary as permission to read or dispatch originals', async () => {
    const f = nativeFixture();
    Reflect.deleteProperty(f.observation, 'verifiedAttachmentMediaTypes');
    await expect(f.subject.execute(f.claim, f.context)).rejects.toThrow(
      'nodia_ai:modality_unavailable',
    );
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

it('API inference binds schema3 reservation and uses the common fenced gateway without advertising MCP', async () => {
  const f = fixture(),
    attemptId = 'f6861b77-a3ca-43d3-bd07-28c667f7e5ae';
  const identity = {
    providerKey: 'openai' as const,
    contractVersion: 'nodia-ai-api-chat/1' as const,
    connectionId: '2',
  };
  f.claim.attempt.id = attemptId;
  f.claim.run.selection_snapshot.mode = 'api_key';
  Object.assign(f.observation, {
    source: 'api_configuration_and_catalog',
    adapterContractVersion: identity.contractVersion,
    adapterIdentity: identity,
    supportsMcp: false,
    supportsTools: true,
    resourceKey: 'api-connection:' + 'a'.repeat(64),
  });
  Object.assign(f.claim.run.context_manifest, {
    resource_key: f.observation.resourceKey,
    adapter_identity: {
      provider_key: identity.providerKey,
      contract_version: identity.contractVersion,
      connection_id: identity.connectionId,
    },
  });
  Object.assign(f.reservation, {
    resourceKey: f.observation.resourceKey,
    operationRef: attemptId,
  });
  const terminalProof = {
    engine: 'api_key' as const,
    attemptId,
    operationRef: attemptId,
    resourceKey: f.observation.resourceKey,
    sessionGeneration: f.observation.sessionGeneration,
    adapterIdentity: identity,
    terminalProofId: 'd54ca1c1-ac26-4a20-b5f5-f78251ed559a',
    localTransportClosed: true as const,
    remoteOutcome: 'completed' as const,
    outcome: 'completed' as const,
    observedAt: new Date(),
  };
  const original = f.query.getMockImplementation()!;
  f.query.mockImplementation(async (sql, args) =>
    sql.startsWith('SELECT resource_key FROM nodia_ai_runtime_slots')
      ? [{ resource_key: f.observation.resourceKey }]
      : original(sql, args),
  );
  f.adapter.execute.mockImplementationOnce(
    async (request: NodiaAiAdapterRequest) => {
      expect(f.armDispatch).toHaveBeenCalledOnce();
      await request.onLeaseCheck!(f.context.signal);
      await request.onProtocolProgress!(2, f.context.signal, 0);
      await request.onToolCall!(
        { callId: 'api-call', name: 'nodia_knowledge_index', arguments: {} },
        f.context.signal,
      );
      return { kind: 'answer', text: 'Synthetic API answer', terminalProof };
    },
  );
  const outcome = await f.subject.execute(f.claim, f.context);
  expect(outcome.status).toBe('completed');
  expect('terminalProof' in outcome && outcome.terminalProof).toEqual(
    terminalProof,
  );
  expect(f.tools.execute).toHaveBeenCalledExactlyOnceWith(f.claim, f.context, {
    callId: 'api-call',
    name: 'nodia_knowledge_index',
    arguments: {},
  });
  expect(f.armDispatch).toHaveBeenCalledWith(
    f.claim.run.selection_snapshot,
    expect.objectContaining({
      adapterIdentity: identity,
      resourceKey: f.observation.resourceKey,
      sessionGeneration: f.observation.sessionGeneration,
    }),
    expect.any(Function),
  );
});
