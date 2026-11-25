import type { EntityManager } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { AiSelection } from '../ai-generation/ai-selection.js';
import { agenticHash } from '../ai-generation/agentic-text-contract.js';
import type {
  ApiNodiaAiCredentialsService,
  NodiaAiApiConfiguration,
} from '../nodia-ai-adapter/api-nodia-ai-credentials.service.js';
import { NodiaAiAdapterError } from '../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import type { NodiaAiConnectionsService } from '../nodia-ai-conversation/nodia-ai-connections.service.js';
import type { NodiaAiRuntimePolicy } from '../nodia-ai-runtime/config/runtime-policy.js';
import type { NodiaCvCodexSelection } from './agentic/nodia-cv-codex-selection.js';
import type { NodiaCvCodexTransport } from './agentic/nodia-cv-codex-transport.js';
import type {
  CvGeminiObservation,
  NodiaCvGeminiTransport,
} from './agentic/nodia-cv-gemini-transport.js';
import {
  cvAgenticObservationBusy,
  NodiaCvSelectionService,
  type CvAgenticObservation,
} from './nodia-cv-selection.service.js';

const selection: AiSelection = {
  connection_id: '9007199254740993',
  mode: 'api_key',
  model_id: 'synthetic-model',
  effort_id: null,
};
const configuration: NodiaAiApiConfiguration = {
  providerKey: 'openai',
  connectionId: selection.connection_id,
  keyId: '7',
  configurationGeneration: 'version-1',
  resourceKey: 'synthetic-resource',
  sessionGeneration: 'epoch-1',
};

function fixture(
  policyHash = 'runtime-policy-1',
  codex?: NodiaCvCodexTransport,
  codexSelection?: NodiaCvCodexSelection,
  gemini?: NodiaCvGeminiTransport,
) {
  const resolveConfiguration = vi.fn().mockResolvedValue(configuration);
  const list = vi.fn();
  const find = vi.fn();
  const query = vi.fn().mockResolvedValue([]);
  const manager = { query } as unknown as EntityManager;
  const transaction = async (
    work: (value: EntityManager) => Promise<unknown>,
  ) => work(manager);
  const selectionService = new NodiaCvSelectionService(
    {
      configuration: resolveConfiguration,
    } as unknown as ApiNodiaAiCredentialsService,
    { list, find, transaction } as unknown as NodiaAiConnectionsService,
    { policyHash, results: { list_default_rows: 1 } } as NodiaAiRuntimePolicy,
    codex,
    codexSelection,
    gemini,
  );

  return { selectionService, resolveConfiguration, manager, query, list, find };
}

const geminiConnection = {
  id: '9007199254740994',
  label: 'Gemini fixture',
  provider_key: 'gemini',
  is_active: true,
  catalog_active: true,
  is_default: false,
  default_mode: 'agentic',
  use_api_key: true,
  can_use_api_key: true,
  use_agentic: true,
  can_use_agentic: true,
  configuration_updated_at: new Date('2026-11-25T00:00:00.000Z'),
  fields: {
    agentic: {
      allowed_model_ids: [
        'gemini-fixture-medium',
        'gemini-fixture-high',
        'other-fixture',
      ],
      available_models: [
        { id: 'gemini-fixture-medium', displayName: 'Gemini Fixture (Medium)' },
        { id: 'gemini-fixture-high', displayName: 'Gemini Fixture (High)' },
        { id: 'other-fixture', displayName: 'Other fixture' },
      ],
      selected_model: 'gemini-fixture-medium',
      thinking_level: 'medium',
    },
    api_key: { available_models: [{ id: 'api-fixture' }] },
  },
};
const geminiRequested = {
  connection_id: geminiConnection.id,
  mode: 'agentic',
  model_id: 'gemini-fixture-high',
  effort_id: 'high',
} as const satisfies AiSelection;
const geminiNative: CvGeminiObservation = {
  available: true,
  reason: null,
  observedAt: '2026-11-25T00:00:00.000Z',
  resourceKey: 'gemini-profile:' + '1'.repeat(64),
  sessionGeneration: '2'.repeat(32),
  policyHash: '3'.repeat(64),
  runtimeHash: '4'.repeat(64),
  binarySha512: '5'.repeat(128),
};

function geminiFixture() {
  const observe = vi.fn().mockResolvedValue(geminiNative);
  const codexObserve = vi.fn();
  const f = fixture(
    'runtime-policy-1',
    { observe: codexObserve } as unknown as NodiaCvCodexTransport,
    {} as NodiaCvCodexSelection,
    { observe } as unknown as NodiaCvGeminiTransport,
  );
  f.find.mockResolvedValue(geminiConnection);
  f.list.mockResolvedValue([geminiConnection]);
  return { ...f, observe, codexObserve };
}

function agenticFixture() {
  const requested = {
    ...selection,
    mode: 'agentic',
    effort_id: 'high',
  } as const;
  const observation = {
    selection: {
      selection: requested,
      status: 'metadata_ready',
      qualified: false,
      providerKey: 'openai',
      configurationGeneration: 'c'.repeat(64),
      sessionGeneration: 'd'.repeat(32),
      resourceKey: 'codex-profile:' + 'e'.repeat(64),
      checkedAt: new Date('2026-11-25T00:00:00Z').toISOString(),
    },
    transport: {
      status: 'available',
      host: {},
      policyHash: 'a'.repeat(64),
      runtimeHash: 'b'.repeat(64),
    },
  } as const as Extract<
    NonNullable<CvAgenticObservation>,
    { transport: { status: 'available' } }
  >;
  const observe = vi.fn(async () => observation);
  const matchesConfiguration = vi.fn().mockResolvedValue(true);
  return {
    ...fixture(
      'runtime-policy-1',
      { observe } as unknown as NodiaCvCodexTransport,
      { matchesConfiguration } as unknown as NodiaCvCodexSelection,
    ),
    requested,
    observation,
    observe,
    matchesConfiguration,
  };
}

describe('Nodia CV selection', () => {
  it('distinguishes configured and qualified using the exact scope receipt', async () => {
    const { selectionService, manager, query, resolveConfiguration } =
      fixture();
    await expect(
      selectionService.eligibility(manager, selection),
    ).resolves.toMatchObject({
      configured: true,
      qualified: false,
      eligible: false,
      reason_code: 'qualification_required',
      checked_at: null,
    });
    expect(resolveConfiguration).toHaveBeenCalledWith(selection, manager);
    expect(query.mock.calls[0][1]).toEqual([
      selectionService.scopeHash(selection, configuration),
    ]);

    const checkedAt = new Date('2026-11-24T00:00:00Z');
    query.mockResolvedValue([{ checked_at: checkedAt }]);
    await expect(
      selectionService.eligibility(manager, selection),
    ).resolves.toMatchObject({
      configured: true,
      qualified: true,
      eligible: true,
      reason_code: 'qualified',
      checked_at: checkedAt,
    });
  });

  it('changes the qualification scope for a distinct model, effort, key, epoch or policy', () => {
    const { selectionService } = fixture();
    const original = selectionService.scopeHash(selection, configuration);
    expect(
      new Set([
        original,
        selectionService.scopeHash(
          { ...selection, model_id: 'other-model' },
          configuration,
        ),
        selectionService.scopeHash(
          { ...selection, effort_id: 'high' },
          configuration,
        ),
        selectionService.scopeHash(selection, { ...configuration, keyId: '8' }),
        selectionService.scopeHash(selection, {
          ...configuration,
          sessionGeneration: 'epoch-2',
        }),
        fixture('runtime-policy-2').selectionService.scopeHash(
          selection,
          configuration,
        ),
      ]).size,
    ).toBe(6);
  });

  it('surfaces known API errors and unavailable Agentic without reading a qualification or switching modes', async () => {
    const { selectionService, manager, query, resolveConfiguration } =
      fixture();
    const agentic = { ...selection, mode: 'agentic' as const };
    await expect(
      selectionService.eligibility(manager, agentic),
    ).resolves.toMatchObject({
      selection: agentic,
      configured: null,
      qualified: false,
      eligible: false,
      reason_code: 'agentic_transport_unavailable',
    });
    await expect(selectionService.configure(agentic, manager)).rejects.toThrow(
      'nodiaCv:agentic_transport_unavailable',
    );
    expect(resolveConfiguration).not.toHaveBeenCalled();

    resolveConfiguration.mockRejectedValueOnce(
      new NodiaAiAdapterError('api_model_unavailable', 'not_dispatched'),
    );
    await expect(
      selectionService.eligibility(manager, selection),
    ).resolves.toMatchObject({
      configured: false,
      eligible: false,
      reason_code: 'configuration_unavailable',
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('keeps live Agentic metadata unqualified until the exact scope has a CV acceptance', async () => {
    const f = agenticFixture();
    const signal = new AbortController().signal;
    const observation = await f.selectionService.observeAgentic(
      f.requested,
      signal,
    );
    expect(f.observe).toHaveBeenCalledWith(f.requested, signal);
    expect(f.query).not.toHaveBeenCalled();
    expect(f.matchesConfiguration).not.toHaveBeenCalled();
    const config = await f.selectionService.configureAgentic(
      f.requested,
      f.manager,
      observation,
    );
    const scopeHash = f.selectionService.scopeHash(f.requested, config);
    expect(config).toMatchObject({
      keyId: null,
      policyHash: 'a'.repeat(64),
      runtimeHash: 'b'.repeat(64),
    });
    const eligibility = await f.selectionService.eligibility(
      f.manager,
      f.requested,
      observation,
    );
    expect(eligibility).toMatchObject({
      configured: true,
      qualified: false,
      eligible: false,
      reason_code: 'qualification_required',
    });
    expect(f.query.mock.calls[0][1]).toEqual([scopeHash]);
    const checkedAt = new Date('2026-11-25T00:00:00Z');
    f.query.mockResolvedValueOnce([{ checked_at: checkedAt }]);
    await expect(
      f.selectionService.eligibility(f.manager, f.requested, observation),
    ).resolves.toMatchObject({
      eligible: true,
      qualified: true,
      checked_at: checkedAt,
    });
    expect(f.resolveConfiguration).not.toHaveBeenCalled();
  });

  it.each([
    ['agentic_connection_unavailable', 'configuration_unavailable', false],
    ['codex_runtime_unavailable', 'codex_runtime_unavailable', null],
    ['codex_timeout', 'codex_runtime_unavailable', null],
    ['codex_session_required', 'codex_session_required', null],
    ['codex_session_unverified', 'codex_session_unverified', null],
    ['codex_profile_busy', 'codex_profile_busy', null],
    ['codex_usage_unavailable', 'codex_usage_unavailable', null],
    ['codex_model_not_allowed', 'codex_model_unavailable', false],
    ['codex_model_unavailable', 'codex_model_unavailable', false],
    ['codex_effort_unavailable', 'codex_effort_unavailable', false],
  ] as const)(
    'reports %s from the current observation without checking qualifications',
    async (status, reason, configured) => {
      const f = agenticFixture();
      await expect(
        f.selectionService.eligibility(f.manager, f.requested, {
          selection: {
            selection: f.requested,
            status,
            qualified: false,
            checkedAt: null,
          },
          transport: { status: 'unobserved' },
        }),
      ).resolves.toEqual({
        selection: f.requested,
        configured,
        qualified: false,
        eligible: false,
        reason_code: reason,
        checked_at: null,
      });
      expect(f.query).not.toHaveBeenCalled();
      expect(f.resolveConfiguration).not.toHaveBeenCalled();
    },
  );

  it.each([
    [{ status: 'host_unavailable' }, 'agentic_transport_unavailable', null],
    [
      { status: 'selection_unsupported', reason: 'codex_model_incompatible' },
      'codex_model_unavailable',
      false,
    ],
    [
      { status: 'selection_unsupported', reason: 'codex_effort_unavailable' },
      'codex_effort_unavailable',
      false,
    ],
  ] as const)(
    'reports the restricted host preflight independently of a connected account (%s)',
    async (transport, reason, configured) => {
      const f = agenticFixture();
      await expect(
        f.selectionService.eligibility(f.manager, f.requested, {
          selection: f.observation.selection,
          transport,
        }),
      ).resolves.toMatchObject({
        configured,
        qualified: false,
        eligible: false,
        reason_code: reason,
        checked_at: null,
      });
      expect(f.query).not.toHaveBeenCalled();
      expect(f.resolveConfiguration).not.toHaveBeenCalled();
    },
  );

  it('rejects an observation from a different effort or a changed configuration before checking qualifications', async () => {
    const f = agenticFixture();
    await expect(
      f.selectionService.eligibility(
        f.manager,
        { ...f.requested, effort_id: 'medium' },
        f.observation,
      ),
    ).resolves.toMatchObject({
      eligible: false,
      reason_code: 'configuration_unavailable',
    });
    expect(f.matchesConfiguration).not.toHaveBeenCalled();
    f.matchesConfiguration.mockResolvedValueOnce(false);
    await expect(
      f.selectionService.eligibility(f.manager, f.requested, f.observation),
    ).resolves.toMatchObject({
      eligible: false,
      reason_code: 'configuration_unavailable',
    });
    expect(f.query).not.toHaveBeenCalled();
  });

  it('invalidates Agentic qualification for another effort, session, configuration, policy or runtime', async () => {
    const f = agenticFixture();
    const config = await f.selectionService.configureAgentic(
      f.requested,
      f.manager,
      f.observation,
    );
    const original = f.selectionService.scopeHash(f.requested, config);
    expect(
      f.selectionService.scopeHash(
        { ...f.requested, effort_id: 'medium' },
        config,
      ),
    ).not.toBe(original);
    for (const key of [
      'sessionGeneration',
      'configurationGeneration',
      'policyHash',
      'runtimeHash',
    ] as const) {
      expect(
        f.selectionService.scopeHash(f.requested, {
          ...config,
          [key]: 'changed',
        }),
      ).not.toBe(original);
    }
  });

  it('binds Gemini metadata and qualification to the exact connection, model, effort, and session', async () => {
    const f = geminiFixture();
    const signal = new AbortController().signal;
    const observation = await f.selectionService.observeAgentic(
      geminiRequested,
      signal,
    );
    const configurationGeneration = agenticHash({
      connection_id: geminiConnection.id,
      provider_key: 'gemini',
      mode: 'agentic',
      fields: geminiConnection.fields.agentic,
      updated_at: geminiConnection.configuration_updated_at,
      enabled: true,
    });
    expect(f.observe).toHaveBeenCalledWith(
      geminiRequested,
      configurationGeneration,
      expect.any(AbortSignal),
    );
    expect(f.codexObserve).not.toHaveBeenCalled();
    const config = await f.selectionService.configureAgentic(
      geminiRequested,
      f.manager,
      observation,
    );
    expect(config).toMatchObject({
      providerKey: 'gemini',
      keyId: null,
      configurationGeneration,
      sessionGeneration: geminiNative.sessionGeneration,
    });

    const scopeHash = f.selectionService.scopeHash(geminiRequested, config);
    f.query.mockImplementation(async (_sql: string, params: unknown[]) =>
      params[0] === scopeHash
        ? [{ checked_at: new Date(geminiNative.observedAt) }]
        : [],
    );
    await expect(
      f.selectionService.eligibility(f.manager, geminiRequested, observation),
    ).resolves.toMatchObject({ eligible: true, reason_code: 'qualified' });
    await expect(
      f.selectionService.eligibility(
        f.manager,
        { ...geminiRequested, effort_id: 'low' },
        observation,
      ),
    ).resolves.toMatchObject({
      eligible: false,
      reason_code: 'configuration_unavailable',
    });

    f.observe.mockResolvedValue({
      ...geminiNative,
      sessionGeneration: '6'.repeat(32),
    });
    const renewed = await f.selectionService.observeAgentic(
      geminiRequested,
      signal,
    );
    await expect(
      f.selectionService.eligibility(f.manager, geminiRequested, renewed),
    ).resolves.toMatchObject({
      eligible: false,
      reason_code: 'qualification_required',
    });

    f.find.mockResolvedValue({
      ...geminiConnection,
      configuration_updated_at: new Date('2026-11-25T01:00:00Z'),
    });
    await expect(
      f.selectionService.eligibility(f.manager, geminiRequested, observation),
    ).resolves.toMatchObject({
      eligible: false,
      reason_code: 'configuration_unavailable',
    });
    expect(f.query).toHaveBeenCalledTimes(2);
  });

  it('blocks Gemini before qualification lookup when its native profile is busy or the model is not configured', async () => {
    const f = geminiFixture();
    const signal = new AbortController().signal;
    f.observe.mockResolvedValue({
      ...geminiNative,
      available: false,
      reason: 'runtime_busy',
    });
    const busy = await f.selectionService.observeAgentic(
      geminiRequested,
      signal,
    );
    expect(cvAgenticObservationBusy(busy)).toBe(true);
    await expect(
      f.selectionService.eligibility(f.manager, geminiRequested, busy),
    ).resolves.toMatchObject({
      eligible: false,
      reason_code: 'gemini_profile_busy',
    });

    const requested = { ...geminiRequested, model_id: 'unknown-model' };
    const missing = await f.selectionService.observeAgentic(requested, signal);
    await expect(
      f.selectionService.eligibility(f.manager, requested, missing),
    ).resolves.toMatchObject({
      configured: false,
      eligible: false,
      reason_code: 'gemini_model_unavailable',
    });
    expect(f.observe).toHaveBeenCalledTimes(1);
    expect(f.codexObserve).not.toHaveBeenCalled();
    expect(f.query).not.toHaveBeenCalled();
  });

  it('projects only the exact qualified Gemini option and leaves the API key models available', async () => {
    const f = geminiFixture();
    const observation = await f.selectionService.observeAgentic(
      geminiRequested,
      new AbortController().signal,
    );
    const configuration = await f.selectionService.configureAgentic(
      geminiRequested,
      f.manager,
      observation,
    );
    const qualifies = (
      selection: AiSelection,
      scopeHash = f.selectionService.scopeHash(selection, configuration),
    ) => ({
      connection_id: selection.connection_id,
      model_id: selection.model_id,
      effort_id: selection.effort_id,
      scope_hash: scopeHash,
      configuration_generation: configuration.configurationGeneration,
      session_generation: configuration.sessionGeneration,
      resource_key: configuration.resourceKey,
      policy_hash: configuration.policyHash,
      runtime_hash: configuration.runtimeHash,
    });

    const unqualified = await f.selectionService.catalog(f.manager);
    expect(
      unqualified.items[0].modes.find((m) => m.mode === 'agentic'),
    ).toMatchObject({
      cv_transport: 'unsupported',
      configured_selection: null,
      models: [],
    });

    f.query.mockResolvedValue([
      qualifies(geminiRequested),
      qualifies({ ...geminiRequested, effort_id: 'medium' }),
      qualifies(
        {
          ...geminiRequested,
          model_id: 'gemini-fixture-medium',
          effort_id: 'medium',
        },
        'a'.repeat(64),
      ),
    ]);
    const qualified = await f.selectionService.catalog(f.manager);
    expect(qualified.items[0].modes).toMatchObject([
      {
        mode: 'api_key',
        cv_transport: 'available',
        models: [{ model_id: 'api-fixture' }],
      },
      {
        mode: 'agentic',
        cv_transport: 'available',
        configured_selection: null,
        models: [
          {
            model_id: 'gemini-fixture-high',
            label: 'Gemini Fixture (High)',
            efforts: [{ effort_id: 'high', label: 'high' }],
          },
        ],
      },
    ]);
    expect(f.observe).toHaveBeenCalledTimes(1);
    expect(f.query.mock.calls[1][1]).toEqual([
      JSON.stringify([
        {
          connection_id: geminiRequested.connection_id,
          configuration_generation: configuration.configurationGeneration,
        },
      ]),
    ]);
  });

  it('paginates complete sanitized connections and declares the CV transport explicitly', async () => {
    const { selectionService, manager, list } = fixture();
    const row = {
      id: selection.connection_id,
      label: 'Synthetic',
      provider_key: 'openai',
      is_active: true,
      catalog_active: true,
      is_default: false,
      default_mode: null,
      use_api_key: true,
      can_use_api_key: true,
      use_agentic: true,
      can_use_agentic: true,
      fields: {
        private_value: 'fixture-never-return',
        agentic: {
          allowed_model_ids: ['discovered-model'],
          available_models: [
            {
              id: 'discovered-model',
              displayName: 'Discovered model',
              supportedReasoningEfforts: ['low', 'high'],
            },
            { id: 'excluded-model' },
          ],
          selected_model: 'excluded-model',
        },
        api_key: {
          selected_model: selection.model_id,
          available_models: [
            { id: selection.model_id, hidden: 'fixture-never-return' },
          ],
        },
      },
    };
    const geminiRow = {
      ...row,
      id: '9007199254740994',
      provider_key: 'gemini',
    };
    list.mockResolvedValue([row, geminiRow]);
    const page = await selectionService.catalog(manager);
    expect(page.items).toHaveLength(1);
    expect(page.next_cursor).toBe(selection.connection_id);
    expect(page.items[0].modes).toMatchObject([
      {
        mode: 'api_key',
        cv_transport: 'available',
        models: [{ model_id: selection.model_id }],
      },
      {
        mode: 'agentic',
        cv_transport: 'available',
        configured_selection: null,
        models: [
          {
            model_id: 'discovered-model',
            label: 'Discovered model',
            efforts: [
              { effort_id: 'low', label: 'low' },
              { effort_id: 'high', label: 'high' },
            ],
          },
        ],
      },
    ]);
    expect(JSON.stringify(page)).not.toContain('fixture-never-return');
    expect(JSON.stringify(page)).not.toContain('excluded-model');

    await expect(
      selectionService.catalog(manager, '9223372036854775808'),
    ).rejects.toThrow('nodiaCv:invalid_cursor');
    expect(list).toHaveBeenCalledTimes(1);

    list.mockResolvedValueOnce([geminiRow]);
    await expect(
      selectionService.catalog(manager, selection.connection_id),
    ).resolves.toMatchObject({
      items: [
        {
          provider_key: 'gemini',
          modes: [
            { mode: 'api_key', cv_transport: 'available' },
            { mode: 'agentic', cv_transport: 'unsupported' },
          ],
        },
      ],
    });
  });
});
