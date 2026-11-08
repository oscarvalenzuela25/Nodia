import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { AiProvider } from '../../../ai-provider/entities/ai-provider.entity.js';
import { AiApiKey } from '../../../ai-provider/entities/ai-api-key.entity.js';
import {
  ReadNodiaAiExternalUseCase,
  type NodiaAiExternalReadPorts,
} from './read-external.use-case.js';
import { createNodiaAiExternalReadFamily } from '../external-read.family.js';
import { NodiaAiToolRegistryUseCase } from '../../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import type { NodiaAiToolHandlerContext } from '../../../nodia-ai-tools/types/tool-registry.types.js';
import { CodexRuntimeService } from '../../../common/ai/codex/codex-runtime.service.js';
import { codexError } from '../../../common/ai/codex/codex-contract.js';
import { normalizeGeminiEngineStatus } from '../../../common/ai/gemini-engine-status.js';
function fixture() {
  const provider = Object.assign(new AiProvider(), {
    id: '9007199254740993',
    catalog_id: '2',
    name: 'Synthetic Gemini',
    is_active: true,
    is_default: false,
    use_api_key: false,
    use_agentic: true,
    default_mode: 'agentic',
    auto_rotate_api_keys: false,
    fields: {
      agentic: {
        selected_model: 'dynamic-model',
        ocr_model: 'dynamic-model',
        secret: 'private-nested-marker',
      },
    },
    updated_at: new Date('2026-10-16T00:00:00Z'),
    catalog: {
      id: '2',
      key: 'gemini',
      name: 'Gemini',
      is_active: true,
      can_use_agentic: true,
    },
    api_keys: [],
  });
  let providers: AiProvider[] = [provider];
  let keys: Record<string, unknown>[] = [];
  const providerFind = vi.fn(async () => providers);
  const keysFind = vi.fn(async () => keys);
  let sqlAllowed = true;
  const manager = {
    getRepository: (entity: unknown) => {
      if (!sqlAllowed)
        throw new Error('SQL attempted during external execution');
      return entity === AiProvider
        ? { find: providerFind }
        : entity === AiApiKey
          ? { find: keysFind }
          : {};
    },
  } as unknown as EntityManager;
  const ports = {
    gemini: {
      getDualEngineStatus: vi.fn(async () => ({
        active_engine: 'agentic',
        agentic: {
          available: true,
          authenticated: true,
          quota_observed_at: null,
        },
      })),
      getModelsAndQuota: vi.fn(async () => ({
        available: true,
        authenticated: true,
        models: [
          {
            id: 'dynamic-model',
            name: 'Discovered',
            capabilities: [],
            context_window: null,
          },
        ],
        supported_options: {},
      })),
    },
    api: { listModels: vi.fn(async () => []) },
    codex: {
      observe: vi.fn(async () => ({
        available: true,
        authenticated: false,
        planType: null,
        checkedAt: null,
        reason: null,
        quotas: [
          {
            id: 'window',
            name: null,
            primary: { usedPercent: 0, windowDurationMins: null, resetsAt: 0 },
            secondary: null,
          },
        ],
        lastInferenceAt: null,
        usageAllowed: false,
        private: 'private-codex-marker',
      })),
      snapshot: vi.fn(async () => ({})),
    },
  };
  const typedPorts = ports as unknown as NodiaAiExternalReadPorts;
  const context: NodiaAiToolHandlerContext = {
    manager,
    actor: {
      actorId: '1',
      sessionId: '3a108baf-2432-4dc2-b05a-48cbba1830f9',
      isSuperAdmin: true,
      modules: [],
    },
    moduleRoutes: ['/ai-providers', '/business'],
    maxRows: 100,
    maxCollectionItems: 128,
  };
  const family = createNodiaAiExternalReadFamily(typedPorts);
  const registry = new NodiaAiToolRegistryUseCase([family], 'external-test');
  return {
    provider,
    ports,
    context,
    providerFind,
    keysFind,
    family,
    registry,
    subject: new ReadNodiaAiExternalUseCase(typedPorts),
    setProviders: (rows: AiProvider[]) => {
      providers = rows;
    },
    setKeys: (rows: Record<string, unknown>[]) => {
      keys = rows;
    },
    sql: (allowed: boolean) => {
      sqlAllowed = allowed;
    },
  };
}
describe('ReadNodiaAiExternalUseCase', () => {
  it.each(['health', 'engines'] as const)(
    'does not claim an occupied Agentic account is signed out in %s',
    async (operation) => {
      const f = fixture();
      f.provider.use_agentic = false;
      f.provider.use_agentic = true;
      f.provider.default_mode = 'agentic';
      const native = normalizeGeminiEngineStatus({
        active_engine: 'agentic',
        agentic: {
          available: true,
          has_active_session: false,
          reason: 'runtime_busy',
        },
      })!;
      expect(native.agentic.authenticated).toBe(false); // Existing private DTO marker.
      f.ports.gemini.getDualEngineStatus.mockResolvedValueOnce(native as never);
      const prepared = await f.subject.prepare(operation, {}, f.context);
      const output = await prepared.execute(new AbortController().signal);
      f.registry.validateOutput(
        f.registry.get(
          operation === 'health'
            ? 'nodia_ai_providers_health'
            : 'nodia_ai_providers_gemini_engines',
        )!,
        output,
      );
      expect(output.engines).toMatchObject({
        agentic: {
          available: true,
          authenticated: null,
          quota_observed_at: null,
        },
      });
      if (operation === 'health')
        expect(output.providers).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ status: 'unconfigured' }),
          ]),
        );
    },
  );
  it.each(['health', 'engines'] as const)(
    'projects real native Unix quota observations to the %s ISO contract',
    async (operation) => {
      const timestamp = '2026-10-16T12:00:00.125Z';
      const clock = vi
        .spyOn(Date, 'now')
        .mockReturnValue(Date.parse(timestamp));
      try {
        const f = fixture();
        const seconds = Date.parse(timestamp) / 1000;
        const native = normalizeGeminiEngineStatus({
          active_engine: 'agentic',
          agentic: {
            available: true,
            has_active_session: true,
            quota_source: 'agentic_cli',
            quota_observed_at: seconds,
          },
        })!;
        expect(native.agentic.quota_observed_at).toBe(seconds);
        f.ports.gemini.getDualEngineStatus.mockResolvedValueOnce(
          native as never,
        );
        const prepared = await f.subject.prepare(operation, {}, f.context);
        const output = await prepared.execute(new AbortController().signal);
        f.registry.validateOutput(
          f.registry.get(
            operation === 'health'
              ? 'nodia_ai_providers_health'
              : 'nodia_ai_providers_gemini_engines',
          )!,
          output,
        );
        expect(output.engines).toMatchObject({
          agentic: { quota_observed_at: timestamp },
        });
      } finally {
        clock.mockRestore();
      }
    },
  );
  it.each([0, null])(
    'preserves real zero versus missing Agentic quota observations %s',
    async (timestamp) => {
      const f = fixture();
      f.ports.gemini.getDualEngineStatus.mockResolvedValueOnce({
        active_engine: 'agentic',
        agentic: {
          available: false,
          authenticated: null,
          quota_observed_at: timestamp,
        },
      } as never);
      const prepared = await f.subject.prepare('engines', {}, f.context),
        output = await prepared.execute(new AbortController().signal);
      f.registry.validateOutput(
        f.registry.get('nodia_ai_providers_gemini_engines')!,
        output,
      );
      expect(output.engines).toMatchObject({
        agentic: {
          quota_observed_at:
            timestamp === 0 ? '1970-01-01T00:00:00.000Z' : null,
        },
      });
      expect(output.engines).not.toHaveProperty('web');
    },
  );
  it.each([NaN, Infinity, -1, Number.MAX_VALUE, 'not-a-native-timestamp'])(
    'rejects an invalid native quota observation %s',
    async (timestamp) => {
      const f = fixture();
      f.ports.gemini.getDualEngineStatus.mockResolvedValueOnce({
        active_engine: 'agentic',
        agentic: {
          available: false,
          authenticated: null,
          quota_observed_at: timestamp,
        },
      } as never);
      const prepared = await f.subject.prepare('engines', {}, f.context);
      await expect(
        prepared.execute(new AbortController().signal),
      ).rejects.toThrow('invalid_tool_output');
    },
  );
  it('prepares only SQL, executes all native Gemini read operations without SQL and closes public schemas', async () => {
    for (const [name, operation, input] of [
      ['nodia_ai_providers_health', 'health', {}],
      ['nodia_ai_providers_gemini_engines', 'engines', {}],
      [
        'nodia_ai_providers_models',
        'models',
        { provider_id: '9007199254740993' },
      ],
      ['nodia_invoices_eligible_invoice_connections', 'eligible', {}],
    ] as const) {
      const f = fixture();
      const operationPort = await f.subject.prepare(
        operation,
        input,
        f.context,
      );
      expect(f.ports.gemini.getDualEngineStatus).not.toHaveBeenCalled();
      expect(f.ports.gemini.getModelsAndQuota).not.toHaveBeenCalled();
      f.sql(false);
      const output = await operationPort.execute(new AbortController().signal);
      f.registry.validateOutput(f.registry.get(name)!, output);
      expect(JSON.stringify(output)).not.toMatch(
        /private-nested-marker|private-engine-marker|secret|ciphertext/,
      );
      f.sql(true);
      await operationPort.verify(f.context);
      expect(f.providerFind).toHaveBeenCalledWith(
        expect.objectContaining({ take: 101, relations: { catalog: true } }),
      );
      expect(f.keysFind).toHaveBeenCalledWith(
        expect.objectContaining({ take: 129 }),
      );
    }
  });
  it('preserves exact BIGINT identity, false, null and observed zero without private runtime properties', async () => {
    const f = fixture();
    Object.assign(f.provider.catalog!, { key: 'openai' });
    const prepared = await f.subject.prepare(
      'codex',
      { provider_id: f.provider.id },
      f.context,
    );
    f.sql(false);
    const output = await prepared.execute(new AbortController().signal);
    f.registry.validateOutput(
      f.registry.get('nodia_ai_providers_codex_session')!,
      output,
    );
    expect(output).toMatchObject({
      provider_id: '9007199254740993',
      authenticated: false,
      usage_allowed: false,
      checked_at: null,
      quotas: [
        { primary: { usedPercent: 0, resetsAt: 0, windowDurationMins: null } },
      ],
    });
    expect(JSON.stringify(output)).not.toContain('private-codex-marker');
  });
  it('rejects config/key changes, provider deletion and resource substitution before publishing a result', async () => {
    const f = fixture();
    const prepared = await f.subject.prepare(
      'models',
      { provider_id: f.provider.id },
      f.context,
    );
    f.provider.fields.agentic.selected_model = 'changed-model';
    await expect(prepared.verify(f.context)).rejects.toThrow(
      'capability_denied',
    );
    f.setProviders([]);
    await expect(prepared.verify(f.context)).rejects.toThrow(
      'resource_unavailable',
    );
  });
  it('derives finite root/key query bounds from policy context and rejects overflow before external calls', async () => {
    const f = fixture();
    f.setProviders([f.provider, f.provider]);
    await expect(
      f.subject.prepare('health', {}, { ...f.context, maxRows: 1 }),
    ).rejects.toThrow('context_limit');
    expect(f.ports.gemini.getDualEngineStatus).not.toHaveBeenCalled();
    f.setProviders([f.provider]);
    f.setKeys([{}, {}]);
    await expect(
      f.subject.prepare('health', {}, { ...f.context, maxCollectionItems: 1 }),
    ).rejects.toThrow('context_limit');
    await expect(
      f.subject.prepare('health', {}, { ...f.context, maxRows: undefined }),
    ).rejects.toThrow('invalid_tool_context');
  });
  it('rejects wrong connections and invalid exact BIGINT IDs before touching remote adapters', async () => {
    const f = fixture();
    await expect(
      f.subject.prepare('codex', { provider_id: f.provider.id }, f.context),
    ).rejects.toThrow('invalid_tool_input');
    await expect(
      f.subject.prepare(
        'models',
        { provider_id: '9223372036854775808' },
        f.context,
      ),
    ).rejects.toThrow('invalid_tool_input');
    expect(f.ports.codex.observe).not.toHaveBeenCalled();
  });
  it('forwards cancellation to the native adapter and rejects a late result after abort', async () => {
    const f = fixture();
    const controller = new AbortController();
    f.ports.gemini.getDualEngineStatus.mockImplementationOnce(async () => {
      controller.abort();
      return null as never;
    });
    const prepared = await f.subject.prepare('engines', {}, f.context);
    await expect(prepared.execute(controller.signal)).rejects.toThrow();
    expect(f.ports.gemini.getDualEngineStatus).toHaveBeenCalledWith(
      controller.signal,
    );
    await prepared.discard!();
    await expect(
      prepared.execute(new AbortController().signal),
    ).rejects.toThrow('capability_denied');
  });
  it('keeps failed or absent observations unknown and never substitutes configuration as discovered models', async () => {
    const f = fixture();
    f.ports.gemini.getDualEngineStatus.mockResolvedValueOnce(null as never);
    const prepared = await f.subject.prepare('engines', {}, f.context);
    expect(await prepared.execute(new AbortController().signal)).toEqual({
      engines: null,
    });
    f.ports.gemini.getModelsAndQuota.mockRejectedValueOnce(
      new Error('adapter_unavailable'),
    );
    const models = await f.subject.prepare(
      'models',
      { provider_id: f.provider.id },
      f.context,
    );
    await expect(models.execute(new AbortController().signal)).rejects.toThrow(
      'adapter_unavailable',
    );
  });
  it('denies the legacy handler and rejects unknown input/output properties', async () => {
    const f = fixture();
    const tool = f.registry.get('nodia_ai_providers_models')!;
    expect(() =>
      f.registry.validateInput(tool, {
        provider_id: f.provider.id,
        sql: 'SELECT private',
      }),
    ).toThrow();
    expect(() =>
      f.registry.validateOutput(tool, { items: [], private: 'secret' }),
    ).toThrow();
    await expect(tool.handler({}, f.context)).rejects.toThrow(
      'external_checkpoint_required',
    );
  });
  it('reports an occupied native Codex profile as unavailable without stopping someone else operation', async () => {
    const runtime = new CodexRuntimeService();
    const profile = {
      busy: true,
      rpc: { request: vi.fn() },
    } as unknown as Awaited<ReturnType<CodexRuntimeService['get']>>;
    vi.spyOn(runtime, 'get').mockResolvedValue(profile);
    const stop = vi.spyOn(runtime, 'stop').mockResolvedValue();
    try {
      const f = fixture();
      Object.assign(f.provider.catalog!, { key: 'openai' });
      const subject = new ReadNodiaAiExternalUseCase({
        ...f.ports,
        codex: runtime,
      } as unknown as NodiaAiExternalReadPorts);
      const prepared = await subject.prepare(
        'codex',
        { provider_id: f.provider.id },
        f.context,
      );
      const output = await prepared.execute(new AbortController().signal);
      expect(output).toMatchObject({
        available: false,
        authenticated: null,
        checked_at: null,
        reason: 'codex_profile_busy',
      });
      f.registry.validateOutput(
        f.registry.get('nodia_ai_providers_codex_session')!,
        output,
      );
      expect(stop).not.toHaveBeenCalled();
      expect(profile.rpc.request).not.toHaveBeenCalled();
      expect(profile.busy).toBe(true);
    } finally {
      await runtime.onModuleDestroy();
    }
  });
  it('reports known native runtime unavailability while preserving cancellation and unexpected failures', async () => {
    const runtime = new CodexRuntimeService();
    const get = vi
      .spyOn(runtime, 'get')
      .mockRejectedValue(codexError('codex_runtime_unavailable'));
    const stop = vi.spyOn(runtime, 'stop').mockResolvedValue();
    try {
      const f = fixture();
      Object.assign(f.provider.catalog!, { key: 'openai' });
      const subject = new ReadNodiaAiExternalUseCase({
        ...f.ports,
        codex: runtime,
      } as unknown as NodiaAiExternalReadPorts);
      const prepared = await subject.prepare(
        'codex',
        { provider_id: f.provider.id },
        f.context,
      );
      const output = await prepared.execute(new AbortController().signal);
      expect(output).toMatchObject({
        available: false,
        authenticated: null,
        checked_at: null,
        reason: 'codex_runtime_unavailable',
      });
      f.registry.validateOutput(
        f.registry.get('nodia_ai_providers_codex_session')!,
        output,
      );
      expect(stop).not.toHaveBeenCalled();
      get.mockRejectedValueOnce(new Error('unexpected native failure'));
      await expect(
        runtime.observe(f.provider.id, new AbortController().signal),
      ).rejects.toThrow('unexpected native failure');
      const controller = new AbortController();
      controller.abort(new Error('cancelled before acquisition'));
      get.mockClear();
      await expect(
        runtime.observe(f.provider.id, controller.signal),
      ).rejects.toThrow('cancelled before acquisition');
      expect(get).not.toHaveBeenCalled();
      expect(stop).not.toHaveBeenCalled();
    } finally {
      await runtime.onModuleDestroy();
    }
  });
  it('native Codex cancellation stops only the leased profile and releases it after cleanup', async () => {
    const runtime = new CodexRuntimeService();
    const controller = new AbortController();
    let rejectRequest: (error: Error) => void = () => undefined;
    const request = vi.fn(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject;
        }),
    );
    const profile = {
      busy: false,
      lastUsed: 0,
      rpc: { request, alive: true },
    } as unknown as Awaited<ReturnType<CodexRuntimeService['get']>>;
    vi.spyOn(runtime, 'get').mockResolvedValue(profile);
    const stop = vi.spyOn(runtime, 'stop').mockImplementation(async () => {
      rejectRequest(new Error('closed'));
    });
    try {
      const f = fixture();
      Object.assign(f.provider.catalog!, { key: 'openai' });
      // Register the same native owner the real supervisor now checks by
      // reference. Replacing get() alone must not bypass physical ownership.
      (
        runtime as unknown as {
          profiles: Map<string, Promise<typeof profile>>;
        }
      ).profiles.set(f.provider.id, Promise.resolve(profile));
      const subject = new ReadNodiaAiExternalUseCase({
        ...f.ports,
        codex: runtime,
      } as unknown as NodiaAiExternalReadPorts);
      const prepared = await subject.prepare(
        'codex',
        { provider_id: f.provider.id },
        f.context,
      );
      const result = prepared.execute(controller.signal);
      await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
      expect(profile.busy).toBe(true);
      controller.abort(new Error('synthetic cancellation'));
      await expect(result).rejects.toThrow('synthetic cancellation');
      expect(stop).toHaveBeenCalledExactlyOnceWith(f.provider.id);
      expect(profile.busy).toBe(false);
    } finally {
      await runtime.onModuleDestroy();
    }
  });
});
