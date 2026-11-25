import type { DataSource, EntityManager } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { AiSelection } from '../../ai-generation/ai-selection.js';
import type { CodexChatObservation } from '../../common/ai/codex/codex-chat-contract.js';
import type { CodexChatRuntime } from '../../common/ai/codex/codex-chat-runtime.js';
import { codexError } from '../../common/ai/codex/codex-contract.js';
import {
  NodiaAiConnectionsService,
  type NodiaAiConnectionConfiguration,
} from '../../nodia-ai-conversation/nodia-ai-connections.service.js';
import { NodiaCvCodexSelection } from './nodia-cv-codex-selection.js';

const checkedAt = '2026-11-25T10:00:00.000Z';
const selection: AiSelection = {
  connection_id: '1',
  mode: 'agentic',
  model_id: 'fixture-live-model',
  effort_id: 'high',
};

function fixture() {
  const row: NodiaAiConnectionConfiguration = {
    id: '1',
    label: 'fixture connection',
    provider_key: 'openai',
    is_active: true,
    is_default: false,
    default_mode: 'api_key',
    catalog_active: true,
    use_api_key: true,
    use_agentic: true,
    can_use_api_key: true,
    can_use_agentic: true,
    configuration_updated_at: new Date(checkedAt),
    fields: {
      agentic: {
        allowed_model_ids: [selection.model_id],
        available_models: [{ id: 'fixture-saved-only' }],
      },
    },
  };
  const native: CodexChatObservation = {
    session: {
      available: true,
      authenticated: true,
      planType: null,
      checkedAt,
      reason: null,
      quotas: null,
      lastInferenceAt: null,
      usageAllowed: null,
    },
    models: [
      {
        id: selection.model_id,
        name: 'Fixture',
        displayName: 'Fixture',
        description: '',
        contextWindow: null,
        capabilities: [],
        isRecommended: true,
        inputModalities: null,
        supportedReasoningEfforts: ['high'],
      },
    ],
    runtimeSessionId: 'b'.repeat(32),
    resourceKey: 'codex-profile:' + 'a'.repeat(64),
    supportsMcp: false,
  };
  const reads: string[] = [];
  let transactionActive = false;
  const query = vi.fn(async (_query: string, [id]: [string]) => {
    reads.push('configuration');
    return id === row.id ? [structuredClone(row)] : [];
  });
  const manager = { query } as unknown as EntityManager;
  const source = {
    async transaction<T>(work: (manager: EntityManager) => Promise<T>) {
      transactionActive = true;
      try {
        return await work(manager);
      } finally {
        transactionActive = false;
      }
    },
  } as DataSource;
  const runtime = {
    observe: vi.fn(async () => {
      expect(transactionActive).toBe(false);
      reads.push('native metadata');
      return native;
    }),
  };
  const preflight = new NodiaCvCodexSelection(
    new NodiaAiConnectionsService(source),
    runtime as unknown as CodexChatRuntime,
  );
  const observe = (
    candidate: AiSelection = selection,
    signal: AbortSignal = new AbortController().signal,
  ) => preflight.observe(candidate, signal);
  return { row, native, reads, manager, runtime, preflight, observe };
}

describe('CV Codex Agentic preflight', () => {
  it('uses exact live metadata between short configuration reads without granting qualification', async () => {
    const f = fixture();
    expect(await f.observe()).toEqual({
      status: 'metadata_ready',
      selection,
      qualified: false,
      providerKey: 'openai',
      checkedAt,
      configurationGeneration: expect.stringMatching(/^[0-9a-f]{64}$/),
      sessionGeneration: f.native.runtimeSessionId,
      resourceKey: f.native.resourceKey,
    });
    expect(f.reads).toEqual([
      'configuration',
      'native metadata',
      'configuration',
    ]);
    expect(f.runtime.observe).toHaveBeenCalledExactlyOnceWith(
      selection.connection_id,
      expect.any(AbortSignal),
    );
  });

  it.each([
    { mode: 'api_key' as const },
    { connection_id: '9223372036854775808' },
    { model_id: 'fixture-live-model\u0000' },
    { effort_id: 'High' },
  ])(
    'rejects an invalid selection before reading configuration %s',
    async (patch) => {
      const f = fixture();
      expect(await f.observe({ ...selection, ...patch })).toMatchObject({
        status: 'agentic_selection_invalid',
        checkedAt: null,
      });
      expect(f.reads).toEqual([]);
    },
  );

  it.each([
    { use_agentic: false },
    { can_use_agentic: false },
    { catalog_active: false },
    { is_active: false },
    { provider_key: 'gemini' },
    { configuration_updated_at: undefined },
  ])(
    'does not contact Codex for an unavailable connection %s',
    async (patch) => {
      const f = fixture();
      Object.assign(f.row, patch);
      expect(await f.observe()).toMatchObject({
        status: 'agentic_connection_unavailable',
        checkedAt: null,
      });
      expect(f.runtime.observe).not.toHaveBeenCalled();
    },
  );

  it.each([
    { allowed: [] },
    { allowed: ['fixture-saved-only'] },
    { allowed: ['fixture-live-model', 'fixture-live-model'] },
    { allowed: 'invalid' },
  ])(
    'fails closed on a restriction that excludes the requested model %s',
    async ({ allowed }) => {
      const f = fixture();
      f.row.fields = { agentic: { allowed_model_ids: allowed } };
      expect(await f.observe()).toMatchObject({
        status: 'codex_model_not_allowed',
        checkedAt: null,
      });
      expect(f.runtime.observe).not.toHaveBeenCalled();
    },
  );

  it('does not substitute a saved model or an undiscovered explicit effort', async () => {
    const f = fixture();
    f.row.fields = { agentic: { selected_model: 'fixture-saved-only' } };
    expect(
      await f.observe({ ...selection, model_id: 'fixture-saved-only' }),
    ).toMatchObject({
      status: 'codex_model_unavailable',
      checkedAt,
    });
    expect(
      await f.observe({ ...selection, effort_id: 'medium' }),
    ).toMatchObject({
      status: 'codex_effort_unavailable',
      checkedAt,
    });
    expect(await f.observe({ ...selection, effort_id: null })).toMatchObject({
      status: 'metadata_ready',
      qualified: false,
      selection: { effort_id: null },
    });
  });

  it.each([
    [
      { available: false, authenticated: null, checkedAt: null },
      'codex_runtime_unavailable',
    ],
    [{ authenticated: false }, 'codex_session_required'],
    [{ authenticated: null }, 'codex_session_unverified'],
    [{ usageAllowed: false }, 'codex_usage_unavailable'],
  ] as const)(
    'keeps runtime, session and account usage states distinct %s',
    async (patch, status) => {
      const f = fixture();
      Object.assign(f.native.session, patch);
      expect(await f.observe()).toMatchObject({ status, qualified: false });
    },
  );

  it.each(['codex_profile_busy', 'codex_timeout', 'codex_protocol_invalid'])(
    'preserves the native observation failure %s without asserting a login problem',
    async (issue) => {
      const f = fixture();
      f.runtime.observe.mockRejectedValueOnce(codexError(issue));
      expect(await f.observe()).toMatchObject({
        status: issue,
        checkedAt: null,
      });
    },
  );

  it('rejects an authentication observation without the profile generation', async () => {
    const f = fixture();
    f.native.runtimeSessionId = '';
    expect(await f.observe()).toMatchObject({
      status: 'codex_protocol_invalid',
      checkedAt,
    });
  });

  it('discards in-flight metadata when the configuration epoch moves', async () => {
    const f = fixture();
    f.runtime.observe.mockImplementationOnce(async () => {
      f.row.configuration_updated_at = new Date('2026-11-25T10:00:01.000Z');
      return f.native;
    });
    expect(await f.observe()).toMatchObject({
      status: 'configuration_changed',
      checkedAt: null,
      qualified: false,
    });
  });

  it('rechecks exact configuration identity before persistence without another native call', async () => {
    const f = fixture();
    const observed = await f.observe();
    if (observed.status !== 'metadata_ready') throw Error(observed.status);
    expect(await f.preflight.matchesConfiguration(f.manager, observed)).toBe(
      true,
    );

    f.row.fields = { agentic: { allowed_model_ids: [] } };
    expect(await f.preflight.matchesConfiguration(f.manager, observed)).toBe(
      false,
    );
    expect(f.runtime.observe).toHaveBeenCalledTimes(1);
  });

  it('propagates caller cancellation instead of converting it into runtime health', async () => {
    const f = fixture();
    const controller = new AbortController();
    const reason = new Error('cancelled by fixture');
    f.runtime.observe.mockImplementationOnce(async () => {
      controller.abort(reason);
      return f.native;
    });
    await expect(f.observe(selection, controller.signal)).rejects.toBe(reason);
    expect(f.reads).toEqual(['configuration']);
  });
});
