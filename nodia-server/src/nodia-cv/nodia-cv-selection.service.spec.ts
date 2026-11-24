import type { EntityManager } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { AiSelection } from '../ai-generation/ai-selection.js';
import type {
  ApiNodiaAiCredentialsService,
  NodiaAiApiConfiguration,
} from '../nodia-ai-adapter/api-nodia-ai-credentials.service.js';
import { NodiaAiAdapterError } from '../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import type { NodiaAiConnectionsService } from '../nodia-ai-conversation/nodia-ai-connections.service.js';
import type { NodiaAiRuntimePolicy } from '../nodia-ai-runtime/config/runtime-policy.js';
import { NodiaCvSelectionService } from './nodia-cv-selection.service.js';

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

function fixture(policyHash = 'runtime-policy-1') {
  const resolveConfiguration = vi.fn().mockResolvedValue(configuration);
  const list = vi.fn();
  const query = vi.fn().mockResolvedValue([]);
  const manager = { query } as unknown as EntityManager;
  const selectionService = new NodiaCvSelectionService(
    {
      configuration: resolveConfiguration,
    } as unknown as ApiNodiaAiCredentialsService,
    { list } as unknown as NodiaAiConnectionsService,
    { policyHash, results: { list_default_rows: 1 } } as NodiaAiRuntimePolicy,
  );

  return { selectionService, resolveConfiguration, manager, query, list };
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
        api_key: {
          selected_model: selection.model_id,
          available_models: [
            { id: selection.model_id, hidden: 'fixture-never-return' },
          ],
        },
      },
    };
    list.mockResolvedValue([row, { ...row, id: '9007199254740994' }]);
    const page = await selectionService.catalog(manager);
    expect(page.items).toHaveLength(1);
    expect(page.next_cursor).toBe(selection.connection_id);
    expect(page.items[0].modes).toMatchObject([
      {
        mode: 'api_key',
        cv_transport: 'available',
        models: [{ model_id: selection.model_id }],
      },
      { mode: 'agentic', cv_transport: 'unsupported', models: [] },
    ]);
    expect(JSON.stringify(page)).not.toContain('fixture-never-return');

    await expect(
      selectionService.catalog(manager, '9223372036854775808'),
    ).rejects.toThrow('nodiaCv:invalid_cursor');
    expect(list).toHaveBeenCalledTimes(1);
  });
});
