import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import {
  ApiNodiaAiCredentialsService,
  type NodiaAiApiConfiguration,
} from './api-nodia-ai-credentials.service.js';
import { encryptSecret } from '../ai-provider/helpers/ai-key-crypto.helper.js';
import type { NodiaAiSelection } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

const selection: NodiaAiSelection = {
  connection_id: '9007199254740993',
  mode: 'api_key',
  model_id: 'fixture-catalog-model',
  effort_id: 'low',
};
function setup() {
  const row = {
    id: selection.connection_id,
    fields: {
      agentic: { selected_model: 'other-channel' },
      api_key: { available_models: [{ id: selection.model_id }] },
    },
    updated_at: new Date('2026-10-27T00:00:00Z'),
    provider_key: 'openai',
    is_active: true,
    use_api_key: true,
    catalog_active: true,
    can_use_api_key: true,
    key_id: '9007199254740994',
    secret_fingerprint: 'a'.repeat(64),
    key_updated_at: new Date('2026-10-27T00:00:00Z'),
    cooldown_until: null,
    key_active: true,
    is_selected: true,
  };
  const cipher = encryptSecret('synthetic-api-credential');
  const query = vi.fn(async (sql: string) =>
    sql.includes('SELECT secret_ciphertext')
      ? [{ secret_ciphertext: cipher }]
      : [row],
  );
  return {
    row,
    query,
    loader: new ApiNodiaAiCredentialsService({
      manager: { query },
    } as unknown as DataSource),
  };
}
beforeEach(() => vi.stubEnv('AI_SECRET_MASTER_KEY', '1'.repeat(64)));
afterEach(() => vi.unstubAllEnvs());
describe('API credential/configuration identity', () => {
  it.each(['xhigh', 'max'])('keeps an OpenAI %s selection exact but rejects it for Gemini before decrypting secrets', async effort => {
    const f = setup();
    const exact = { ...selection, effort_id: effort };
    expect(await f.loader.configuration(exact)).toMatchObject({ providerKey: 'openai' });
    f.row.provider_key = 'gemini';
    await expect(f.loader.configuration(exact)).rejects.toMatchObject({ code: 'adapter_invalid_selection', outcome: 'not_dispatched' });
    expect(f.query.mock.calls.some(([sql]) => sql.includes('SELECT secret_ciphertext'))).toBe(false);
  });
  it('rejects an unsupported Ultra API selection before consulting credentials', async () => {
    const f = setup();
    await expect(f.loader.configuration({ ...selection, effort_id: 'ultra' })).rejects.toMatchObject({ code: 'adapter_invalid_selection' });
    expect(f.query).not.toHaveBeenCalled();
  });
  it('uses exact bigint IDs and returns metadata only; decrypted secret is resolved separately for the same epoch', async () => {
    const f = setup();
    const config = await f.loader.configuration(selection);
    expect(config).toMatchObject({
      providerKey: 'openai',
      connectionId: selection.connection_id,
      keyId: f.row.key_id,
    });
    expect(config.resourceKey).toMatch(/^api-connection:[a-f0-9]{64}$/);
    expect(config.sessionGeneration).toMatch(/^[a-f0-9]{32}$/);
    expect(JSON.stringify(config)).not.toContain('synthetic-api-credential');
    expect(f.query.mock.calls[0][0]).not.toContain('secret_ciphertext');
    expect(await f.loader.secret(selection, config)).toBe(
      'synthetic-api-credential',
    );
    const keyQuery = f.query.mock.calls.find(([sql]) =>
      sql.includes('SELECT secret_ciphertext'),
    );
    expect(keyQuery?.[0]).toContain('is_selected=true');
  });
  it.each([
    'is_active',
    'use_api_key',
    'catalog_active',
    'can_use_api_key',
    'key_active',
    'is_selected',
  ] as const)(
    'rejects disabled %s instead of rotating or borrowing Agentic readiness',
    async (flag) => {
      const f = setup();
      f.row[flag] = false;
      await expect(f.loader.configuration(selection)).rejects.toMatchObject({
        code: 'api_configuration_unavailable',
        outcome: 'not_dispatched',
      });
      expect(f.query).toHaveBeenCalledOnce();
    },
  );
  it('requires the exact model in the API scope and never borrows the other channel or a default', async () => {
    const f = setup();
    f.row.fields.api_key.available_models = [];
    await expect(f.loader.configuration(selection)).rejects.toMatchObject({
      code: 'api_model_unavailable',
    });
  });
  it('rejects ambiguous selected keys', async () => {
    const f = setup();
    f.query.mockResolvedValueOnce([f.row, { ...f.row, key_id: '2' }]);
    await expect(f.loader.configuration(selection)).rejects.toMatchObject({
      code: 'api_configuration_unavailable',
    });
  });
  it('invalidates generation for key/catalog/configuration changes without exposing secret material', async () => {
    const f = setup();
    const before = await f.loader.configuration(selection);
    f.row.key_id = '5';
    const after = await f.loader.configuration(selection);
    expect(after.resourceKey).toBe(before.resourceKey);
    expect(after.sessionGeneration).not.toBe(before.sessionGeneration);
    expect(after.configurationGeneration).not.toBe(
      before.configurationGeneration,
    );
    await expect(f.loader.secret(selection, before)).rejects.toMatchObject({
      code: 'adapter_configuration_changed',
    });
    expect(
      f.query.mock.calls.some(([sql]) =>
        sql.includes('SELECT secret_ciphertext'),
      ),
    ).toBe(false);
  });
  it('locks the exact provider/catalog/key through the supplied transaction manager', async () => {
    const f = setup();
    const local = vi.fn().mockResolvedValue([f.row]);
    await f.loader.configuration(selection, {
      query: local,
      queryRunner: { isTransactionActive: true },
    } as unknown as EntityManager);
    expect(local.mock.calls[0][0]).toContain('FOR SHARE OF p,c,k');
    expect(local.mock.calls[0][1]).toEqual([selection.connection_id]);
    expect(f.query).not.toHaveBeenCalled();
  });
  it('sanitizes crypto failures and does not expose ciphertext', async () => {
    const f = setup();
    const config: NodiaAiApiConfiguration =
      await f.loader.configuration(selection);
    f.query.mockImplementation(async (sql) =>
      sql.includes('SELECT secret_ciphertext')
        ? [{ secret_ciphertext: 'private-bad-cipher' }]
        : [f.row],
    );
    await expect(f.loader.secret(selection, config)).rejects.toMatchObject({
      code: 'api_credential_unavailable',
    });
  });
});
