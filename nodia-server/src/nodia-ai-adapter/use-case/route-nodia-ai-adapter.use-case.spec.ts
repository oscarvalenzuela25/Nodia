import { describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { ResolveNodiaAiAdapterUseCase } from './resolve-nodia-ai-adapter.use-case.js';
import { RouteNodiaAiAdapterUseCase } from './route-nodia-ai-adapter.use-case.js';
import { RouteNodiaAiReconciliationUseCase } from './route-nodia-ai-reconciliation.use-case.js';
import type { GeminiNodiaAiAdapterUseCase } from './gemini-nodia-ai-adapter.use-case.js';
import type { ApiNodiaAiAdapterUseCase } from './api-nodia-ai-adapter.use-case.js';
import type { ApiNodiaAiRuntimeService } from '../api-nodia-ai-runtime.service.js';
import type { CodexNodiaAiAdapterUseCase } from './codex-nodia-ai-adapter.use-case.js';
import type { ReconcileGeminiNodiaAiRuntimeUseCase } from './reconcile-gemini-nodia-ai-runtime.use-case.js';
import type { ReconcileCodexNodiaAiRuntimeUseCase } from './reconcile-codex-nodia-ai-runtime.use-case.js';
import type { NodiaAiSelection } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  NodiaAiRuntimeProofRequest,
  NodiaAiRuntimeTerminalProof,
} from '../../nodia-ai-runtime/types/reconciliation.types.js';

vi.mock('../../config/envs.config.js', () => ({
  envs: {
    GEMINI_MICROSERVICE_URL: 'http://127.0.0.1:8000',
    GEMINI_SERVICE_TOKEN: 'ab'.repeat(32),
  },
}));

const selection: NodiaAiSelection = {
  connection_id: '9007199254740993',
  mode: 'agentic',
  model_id: 'fixture-dynamic-model',
  effort_id: 'fixture_effort',
};
const geminiIdentity: NodiaAiRuntimeProofRequest = {
  engine: 'agentic',
  attemptId: 'eadf13a7-4182-4793-b143-869529a38c49',
  operationRef: 'eadf13a7-4182-4793-b143-869529a38c49',
  resourceKey: 'gemini-profile:' + 'a'.repeat(64),
  sessionGeneration: 'b'.repeat(32),
};
const codexIdentity: NodiaAiRuntimeProofRequest = {
  ...geminiIdentity,
  engine: 'agentic',
  resourceKey: 'codex-profile:' + 'a'.repeat(64),
  adapterIdentity: {
    providerKey: 'openai',
    contractVersion: 'nodia-ai-codex-chat/1',
    connectionId: selection.connection_id,
  },
};
function setup(provider = 'openai') {
  const row = {
    id: selection.connection_id,
    provider_key: provider,
    is_active: true,
    catalog_active: true,
    use_agentic: true,
    can_use_agentic: true,
    use_api_key: true,
    can_use_api_key: true,
  };
  const query = vi.fn().mockResolvedValue([row]);
  const resolver = new ResolveNodiaAiAdapterUseCase({
    manager: { query },
  } as unknown as DataSource);
  const port = () => ({
    observe: vi.fn().mockResolvedValue({ available: true }),
    verifyConfiguration: vi.fn(),
    measureContext: vi.fn().mockResolvedValue({ modelContextTokens: null }),
    execute: vi.fn().mockResolvedValue({ kind: 'answer' }),
  });
  const gemini = port(),
    codex = port(),
    api = port();
  const router = new RouteNodiaAiAdapterUseCase(
    resolver,
    gemini as unknown as GeminiNodiaAiAdapterUseCase,
    codex as unknown as CodexNodiaAiAdapterUseCase,
    api as unknown as ApiNodiaAiAdapterUseCase,
  );
  return { row, query, resolver, gemini, codex, api, router };
}

describe('NodiaAI runtime adapter routing', () => {
  it.each(['gemini', 'openai'])(
    'routes every operation using the exact catalog/connection pair for %s',
    async (provider) => {
      const f = setup(provider);
      await f.router.observe(selection);
      await f.router.measureContext({ selection, canonicalPrompt: 'fixture' });
      await f.router.execute({
        selection,
        attemptId: geminiIdentity.attemptId,
        canonicalPrompt: 'fixture',
        deadlineAt: new Date(Date.now() + 1000),
        resourceKey: 'fixture',
        sessionGeneration: 'fixture',
        configurationGeneration: 'fixture',
      });
      await f.router.verifyConfiguration(selection, 'fixture');
      const selected = provider === 'gemini' ? f.gemini : f.codex,
        other = provider === 'gemini' ? f.codex : f.gemini;
      for (const method of [
        'observe',
        'measureContext',
        'execute',
        'verifyConfiguration',
      ] as const) {
        expect(selected[method]).toHaveBeenCalledOnce();
        expect(other[method]).not.toHaveBeenCalled();
      }
      expect(f.query).toHaveBeenCalledTimes(4);
      expect(
        f.query.mock.calls.every(
          (call) => call[1][0] === selection.connection_id,
        ),
      ).toBe(true);
    },
  );
  it.each([
    'id',
    'is_active',
    'catalog_active',
    'use_agentic',
    'can_use_agentic',
  ])('rejects a changed/disabled %s before native calls', async (key) => {
    const f = setup();
    Object.assign(f.row, { [key]: key === 'id' ? '9007199254740992' : false });
    await expect(f.router.observe(selection)).rejects.toMatchObject({
      outcome: 'not_dispatched',
      code: 'adapter_connection_unavailable',
    });
    expect(f.codex.observe).not.toHaveBeenCalled();
    expect(f.gemini.observe).not.toHaveBeenCalled();
  });
  it.each(['gemini', 'openai'])(
    'routes configured %s API exclusively to the API adapter',
    async (provider) => {
      const f = setup(provider);
      await f.router.observe({ ...selection, mode: 'api_key' });
      expect(f.api.observe).toHaveBeenCalledOnce();
      expect(f.codex.observe).not.toHaveBeenCalled();
      expect(f.gemini.observe).not.toHaveBeenCalled();
      f.api.observe.mockRejectedValueOnce(Error('fixture API failure'));
      await expect(
        f.router.observe({ ...selection, mode: 'api_key' }),
      ).rejects.toThrow('fixture API failure');
      expect(f.codex.observe).not.toHaveBeenCalled();
      expect(f.gemini.observe).not.toHaveBeenCalled();
    },
  );
  it.each(['unknown', 'openai'])(
    'never falls back from unsupported %s Web to Gemini',
    async (provider) => {
      const f = setup(provider);
      await expect(
        f.router.observe({
          ...selection,
          mode: 'token_plan_web' as NodiaAiSelection['mode'],
        }),
      ).rejects.toMatchObject({ code: 'adapter_mode_unsupported' });
      expect(f.codex.observe).not.toHaveBeenCalled();
      expect(f.gemini.observe).not.toHaveBeenCalled();
    },
  );
  it.each(['0', '01', '+4', ' 4', '9223372036854775808', '4e2', ''])(
    'rejects noncanonical connection %j without SQL',
    async (id) => {
      const f = setup();
      await expect(
        f.router.observe({ ...selection, connection_id: id }),
      ).rejects.toMatchObject({ code: 'adapter_invalid_selection' });
      expect(f.query).not.toHaveBeenCalled();
    },
  );
  it('rejects retired Web mode before SQL and never turns an adapter error into a second provider dispatch', async () => {
    const f = setup();
    await expect(
      f.router.observe({
        ...selection,
        mode: 'token_plan_web' as NodiaAiSelection['mode'],
      }),
    ).rejects.toMatchObject({ code: 'adapter_mode_unsupported' });
    expect(f.query).not.toHaveBeenCalled();
    f.codex.observe.mockRejectedValueOnce(new Error('fixture native failure'));
    await expect(f.router.observe(selection)).rejects.toThrow(
      'fixture native failure',
    );
    expect(f.gemini.observe).not.toHaveBeenCalled();
  });
  it('locks and validates using the supplied transaction manager, without using the global manager or HTTP', async () => {
    const f = setup();
    const query = vi.fn().mockResolvedValue([{ ...f.row }]);
    const manager = {
      query,
      queryRunner: { isTransactionActive: true },
    } as unknown as EntityManager;
    await f.router.verifyConfiguration(
      selection,
      'fixture-generation',
      manager,
    );
    expect(query.mock.calls[0][0]).toContain('FOR SHARE OF p,c');
    expect(f.query).not.toHaveBeenCalled();
    expect(f.codex.verifyConfiguration).toHaveBeenCalledWith(
      selection,
      'fixture-generation',
      manager,
    );
  });
  it('recovers/ACKs by the persisted schema identity without querying mutable connections', async () => {
    const gemini = {
      reconcile: vi.fn(async (request) => request),
      acknowledge: vi.fn(),
    };
    const codex = {
      reconcile: vi.fn(async (request) => request),
      acknowledge: vi.fn(),
    };
    const router = new RouteNodiaAiReconciliationUseCase(
      gemini as unknown as ReconcileGeminiNodiaAiRuntimeUseCase,
      codex as unknown as ReconcileCodexNodiaAiRuntimeUseCase,
      {
        reconcile: vi.fn(),
        acknowledge: vi.fn(),
      } as unknown as ApiNodiaAiRuntimeService,
    );
    for (const request of [geminiIdentity, codexIdentity]) {
      await router.reconcile(request, new AbortController().signal);
      await router.acknowledge(
        {
          ...request,
          terminalProofId: '1797da24-fc13-4f29-a252-9562e071ca36',
          processClosed: true,
          outcome: 'completed',
          observedAt: new Date(),
        } as NodiaAiRuntimeTerminalProof,
        new AbortController().signal,
      );
    }
    expect(gemini.reconcile).toHaveBeenCalledOnce();
    expect(codex.reconcile).toHaveBeenCalledOnce();
    expect(codex.reconcile.mock.calls[0][0]).toEqual(codexIdentity);
    expect(gemini.acknowledge).toHaveBeenCalledOnce();
    expect(codex.acknowledge).toHaveBeenCalledOnce();
  });
  it('rejects mixed/fabricated runtime identities before any recovery transport', async () => {
    const gemini = { reconcile: vi.fn(), acknowledge: vi.fn() },
      codex = { reconcile: vi.fn(), acknowledge: vi.fn() };
    const router = new RouteNodiaAiReconciliationUseCase(
      gemini as unknown as ReconcileGeminiNodiaAiRuntimeUseCase,
      codex as unknown as ReconcileCodexNodiaAiRuntimeUseCase,
      {
        reconcile: vi.fn(),
        acknowledge: vi.fn(),
      } as unknown as ApiNodiaAiRuntimeService,
    );
    for (const request of [
      { ...codexIdentity, resourceKey: geminiIdentity.resourceKey },
      { ...geminiIdentity, resourceKey: codexIdentity.resourceKey },
      {
        ...codexIdentity,
        adapterIdentity: {
          ...codexIdentity.adapterIdentity,
          connectionId: '04',
        },
      },
    ])
      await expect(
        router.reconcile(
          request as NodiaAiRuntimeProofRequest,
          new AbortController().signal,
        ),
      ).rejects.toThrow();
    expect(gemini.reconcile).not.toHaveBeenCalled();
    expect(codex.reconcile).not.toHaveBeenCalled();
  });
});
