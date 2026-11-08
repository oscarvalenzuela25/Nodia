import { describe, expect, it, vi } from 'vitest';
import { SaveAiProviderConfigurationUseCase } from './save-ai-provider-configuration.use-case.js';
import { configurationFixture } from '../../../test/fixtures/ai-provider-configuration.fixture.js';

describe('SaveAiProviderConfigurationUseCase', () => {
  const fixture = () => {
    const f = configurationFixture();
    return {
      ...f,
      uc: new SaveAiProviderConfigurationUseCase(f.source, f.translations),
    };
  };
  it.each(['token_plan_web', 'token_plan_agentic'])(
    'rejects the retired %s JSON scope before persistence',
    async (scope) => {
      const f = fixture();
      await expect(
        f.uc.execute(
          f.existing.id,
          { fields: { [scope]: { selected_model: 'synthetic' } } },
          f.actor,
        ),
      ).rejects.toThrow('retired_mode');
      expect(f.providerRepo.save).not.toHaveBeenCalled();
    },
  );
  it('locks authority, validates live actor and locks configuration before the first domain read', async () => {
    const f = fixture();
    await f.uc.execute(undefined, { catalog_id: '2' }, f.actor);
    expect(
      f.trace.findIndex((value) => value.includes('LOCK TABLE actions')),
    ).toBeLessThan(
      f.trace.findIndex((value) => value.includes('AS "actorId"')),
    );
    expect(
      f.trace.findIndex((value) =>
        value.includes('LOCK TABLE ai_provider_catalog'),
      ),
    ).toBeLessThan(f.trace.indexOf('catalog-read'));
  });
  it('creates with empty model selection and actual channel precedence without inventing availability', async () => {
    const f = fixture();
    await f.uc.execute(
      undefined,
      {
        catalog_id: '2',
        use_agentic: true,
        fields: {
          selected_model: 'caller-invented-model',
          available_models: [{ id: 'caller-invented-model' }],
        },
      },
      f.actor,
    );
    expect(f.providerRepo.save.mock.calls[0][0]).toMatchObject({
      default_mode: 'agentic',
      is_default: true,
      fields: { available_models: [] },
    });
    expect(f.providerRepo.save.mock.calls[0][0].fields).not.toHaveProperty(
      'selected_model',
    );
    expect(f.trace.indexOf('reset-default')).toBeLessThan(
      f.trace.indexOf('provider-save'),
    );
  });
  it('keeps false defaults explicit and does not reset another connection', async () => {
    const f = fixture();
    await f.uc.execute(
      undefined,
      { catalog_id: '2', is_default: false },
      f.actor,
    );
    expect(f.providerRepo.save.mock.calls[0][0].is_default).toBe(false);
    expect(f.qb.execute).not.toHaveBeenCalled();
  });
  it('patches one dynamic model effort while preserving hidden historical fields, other modes and other models', async () => {
    const f = fixture();
    await f.uc.execute(
      f.existing.id,
      {
        fields: {
          agentic: { thinking_levels: { 'synthetic-model': 'medium' } },
        },
      },
      f.actor,
    );
    expect(f.providerRepo.save.mock.calls[0][0].fields).toEqual({
      legacy: { token: 'synthetic-private-value' },
      agentic: {
        selected_model: 'synthetic-model',
        secret: 'synthetic-mode-secret',
        thinking_levels: { 'synthetic-model': 'medium', other: 'low' },
      },
    });
  });
  it('does not write fields when omitted from a partial update', async () => {
    const f = fixture();
    const previous = structuredClone(f.existing.fields);
    await f.uc.execute(f.existing.id, { name: 'Renamed' }, f.actor);
    expect(f.existing.fields).toEqual(previous);
  });
  it('uses only inherited manager and does not reset authority locks/timeouts', async () => {
    const f = fixture();
    await f.uc.execute(
      f.existing.id,
      { name: 'Updated' },
      { ...f.actor, transaction: f.manager },
    );
    expect(f.source.transaction).not.toHaveBeenCalled();
    expect(
      f.trace.some(
        (value) =>
          value.startsWith('SET LOCAL') ||
          value.startsWith('LOCK TABLE actions'),
      ),
    ).toBe(false);
    expect(f.translations.updateTranslations).toHaveBeenCalledWith(
      'ai_providers',
      f.existing.id,
      undefined,
      f.manager,
    );
  });
  it('rejects inactive inherited transaction before reading identity or domain', async () => {
    const f = fixture();
    f.manager.queryRunner!.isTransactionActive = false;
    await expect(
      f.uc.execute(f.existing.id, {}, { ...f.actor, transaction: f.manager }),
    ).rejects.toThrow('authorization:transaction_required');
    expect(f.trace).toEqual([]);
  });
  it('revalidates a session even for a super administrator', async () => {
    const f = fixture();
    f.setSession(false);
    await expect(f.uc.execute(f.existing.id, {}, f.actor)).rejects.toThrow(
      'auth:session_expired',
    );
    expect(f.providerRepo.save).not.toHaveBeenCalled();
  });
  it('rejects active or reused inherited managers that do not actually hold the authority frontier', async () => {
    const f = fixture();
    f.setAuthorityLocks(false);
    await expect(
      f.uc.execute(f.existing.id, {}, { ...f.actor, transaction: f.manager }),
    ).rejects.toThrow('authorization:authority_transaction_required');
    expect(f.trace.some((value) => value.includes('AS "actorId"'))).toBe(false);
    expect(f.providerRepo.findOne).not.toHaveBeenCalled();
  });
  it('denies a live non admin without the assigned module before configuration access', async () => {
    const f = fixture();
    f.setAdmin(false);
    f.setModule(false);
    await expect(f.uc.execute(f.existing.id, {}, f.actor)).rejects.toThrow(
      'core:module_access_required',
    );
    expect(f.trace).not.toContain('catalog-read');
    expect(f.providerRepo.save).not.toHaveBeenCalled();
  });
  it('permits a live non admin with the assigned module and no action requirement', async () => {
    const f = fixture();
    f.setAdmin(false);
    await f.uc.execute(f.existing.id, { name: 'Allowed' }, f.actor);
    expect(f.existing.name).toBe('Allowed');
  });
  it.each(['use_api_key', 'use_agentic'] as const)(
    'rejects enabling %s when the catalog disallows it',
    async (flag) => {
      const f = fixture();
      f.catalog.can_use_api_key = false;
      f.catalog.can_use_agentic = false;
      f.catalog.can_use_agentic = false;
      await expect(
        f.uc.execute(undefined, { catalog_id: '2', [flag]: true }, f.actor),
      ).rejects.toThrow('ai_provider:channel_not_allowed');
      expect(f.providerRepo.save).not.toHaveBeenCalled();
    },
  );
  it('requires clearing/changing a default mode when its channel is disabled', async () => {
    const f = fixture();
    await expect(
      f.uc.execute(f.existing.id, { use_agentic: false }, f.actor),
    ).rejects.toThrow('ai_provider:default_mode_disabled');
    await f.uc.execute(
      f.existing.id,
      { use_agentic: false, default_mode: null },
      f.actor,
    );
    expect(f.existing.default_mode).toBeNull();
  });
  it('rejects catalog reassignment, including same provider family with different catalog ID', async () => {
    const f = fixture();
    await expect(
      f.uc.execute(f.existing.id, { catalog_id: '3' }, f.actor),
    ).rejects.toThrow('no se puede cambiar');
  });
  it('rejects unknown top level credentials instead of mass assignment', async () => {
    const f = fixture();
    await expect(
      f.uc.execute(
        undefined,
        { catalog_id: '2', secret: 'synthetic-only' } as never,
        f.actor,
      ),
    ).rejects.toThrow('ai_provider:invalid_configuration');
    expect(f.source.transaction).not.toHaveBeenCalled();
  });
  it('propagates translation failure inside the caller transaction', async () => {
    const f = fixture();
    vi.mocked(f.translations.updateTranslations).mockRejectedValue(
      new Error('synthetic translation fault'),
    );
    await expect(
      f.uc.execute(
        f.existing.id,
        { translates: [{ key: 'name', es: 'Nombre', en: 'Name' }] },
        { ...f.actor, transaction: f.manager },
      ),
    ).rejects.toThrow('synthetic translation fault');
  });
  it('rejects malformed and unsafe IDs before opening a transaction', async () => {
    const f = fixture();
    for (const id of ['1e3', '0', '9223372036854775808'])
      await expect(f.uc.execute(id, {}, f.actor)).rejects.toThrow();
    expect(f.source.transaction).not.toHaveBeenCalled();
  });
  it('rejects null object and boolean patches before entering SQL instead of erasing configuration', async () => {
    const f = fixture();
    for (const dto of [
      { fields: null },
      { is_default: null },
      { use_agentic: null },
    ])
      await expect(
        f.uc.execute(f.existing.id, dto as never, f.actor),
      ).rejects.toThrow('ai_provider:invalid_configuration');
    expect(f.source.transaction).not.toHaveBeenCalled();
  });
  it('rejects explicit OpenAI Web activation even if a historical catalog flag is true', async () => {
    const f = fixture();
    f.catalog.key = 'openai';
    await expect(
      f.uc.execute(
        undefined,
        { catalog_id: '2', use_token_plan_web: true },
        f.actor,
      ),
    ).rejects.toThrow('ai_provider:invalid_configuration');
    await expect(
      f.uc.execute(f.existing.id, { use_token_plan_web: true }, f.actor),
    ).rejects.toThrow('ai_provider:invalid_configuration');
    await f.uc.execute(f.existing.id, { name: 'Historical renamed' }, f.actor);
    expect(f.existing.use_agentic).toBe(true);
  });
  it('keeps an explicitly selected dynamic model even when a historical catalog no longer lists it', async () => {
    const f = fixture();
    await f.uc.execute(
      f.existing.id,
      { fields: { agentic: { selected_model: 'future-model-id' } } },
      f.actor,
    );
    expect(f.existing.fields.agentic.selected_model).toBe('future-model-id');
  });
  it('rejects creation against inactive or unimplemented catalogs without affecting defaults', async () => {
    const f = fixture();
    f.catalog.is_active = false;
    await expect(
      f.uc.execute(undefined, { catalog_id: '2' }, f.actor),
    ).rejects.toThrow('activo');
    f.catalog.is_active = true;
    f.catalog.key = 'not-an-implemented-provider';
    await expect(
      f.uc.execute(undefined, { catalog_id: '2' }, f.actor),
    ).rejects.toThrow('implementada');
    expect(f.qb.execute).not.toHaveBeenCalled();
  });
  it.each(['agentic', 'api_key'] as const)(
    'preserves original flat preferences when introducing scoped %s',
    async (mode) => {
      const f = fixture();
      f.existing.fields = {
        selected_model: 'old-flat-model',
        ocr_model: 'old-ocr-model',
        ocr_focus_model: 'old-focus-model',
        thinking_level: 'old-effort',
        thinking_levels: { 'old-flat-model': 'exact-effort' },
        available_models: [{ id: 'old-flat-model' }],
        historical_secret: 'synthetic-private',
      };
      await f.uc.execute(
        f.existing.id,
        { fields: { [mode]: { selected_model: 'new-mode-model' } } },
        f.actor,
      );
      expect(f.existing.fields.agentic).toMatchObject({
        selected_model:
          mode === 'agentic' ? 'new-mode-model' : 'old-flat-model',
        ocr_model: 'old-ocr-model',
        ocr_focus_model: 'old-focus-model',
        thinking_level: 'old-effort',
        thinking_levels: { 'old-flat-model': 'exact-effort' },
        available_models: [{ id: 'old-flat-model' }],
      });
      expect(f.existing.fields.historical_secret).toBe('synthetic-private');
      if (mode !== 'agentic')
        expect(f.existing.fields[mode]).toEqual({
          selected_model: 'new-mode-model',
        });
    },
  );
  it.each([true, false, 0])(
    'preserves historical extended-thinking value %s when introducing the first scope',
    async (value) => {
      const f = fixture();
      f.existing.fields = {
        selected_model: 'old-flat-model',
        enable_extended_thinking: value,
      };
      await f.uc.execute(
        f.existing.id,
        { fields: { agentic: { selected_model: 'new-flat-model' } } },
        f.actor,
      );
      expect(f.existing.fields.agentic.enable_extended_thinking).toBe(value);
      expect(f.existing.fields.enable_extended_thinking).toBe(value);
    },
  );
});
