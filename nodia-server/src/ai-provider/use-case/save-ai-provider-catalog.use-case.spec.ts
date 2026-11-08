import { describe, expect, it } from 'vitest';
import { SaveAiProviderCatalogUseCase } from './save-ai-provider-catalog.use-case.js';
import { configurationFixture } from '../../../test/fixtures/ai-provider-configuration.fixture.js';
import { plainToInstance } from 'class-transformer';
import { UpdateAiProviderCatalogDto } from '../dto/update-ai-provider-catalog.dto.js';

describe('SaveAiProviderCatalogUseCase', () => {
  const fixture = () => {
    const f = configurationFixture();
    return { ...f, uc: new SaveAiProviderCatalogUseCase(f.source) };
  };
  it('normalizes a new catalog key and does not claim integration for a custom catalog', async () => {
    const f = fixture();
    const result = await f.uc.execute(
      undefined,
      {
        key: '  FUTURE-Provider  ',
        name: 'Future provider',
        can_use_api_key: true,
      },
      f.actor,
    );
    expect(result.key).toBe('future-provider');
    expect(result).not.toHaveProperty('available');
  });
  it('rejects normalized duplicate keys before saving', async () => {
    const f = fixture();
    f.catalogRepo.findOneBy.mockResolvedValue(f.catalog);
    await expect(
      f.uc.execute(undefined, { key: ' GEMINI ', name: 'Duplicate' }, f.actor),
    ).rejects.toThrow('ai_provider:catalog_key_exists');
    expect(f.catalogRepo.save).not.toHaveBeenCalled();
  });
  it('updates activity and independent channel flags without altering identity', async () => {
    const f = fixture();
    const result = await f.uc.execute(
      '2',
      { is_active: false, can_use_api_key: false },
      f.actor,
    );
    expect(result).toMatchObject({
      id: '2',
      key: 'gemini',
      is_active: false,
      can_use_api_key: false,
    });
  });
  it('preserves omitted fields in the full REST projection when an ES2023 DTO owns undefined fields', async () => {
    const f = fixture();
    const dto = plainToInstance(UpdateAiProviderCatalogDto, {
      can_use_api_key: false,
    });
    const result = await f.uc.execute('2', dto, f.actor);
    expect(result).toMatchObject({
      id: '2',
      key: 'gemini',
      name: 'Synthetic provider',
      is_active: true,
      can_use_api_key: false,
      can_use_agentic: true,
    });
  });
  it('rejects a key change and unknown properties before starting SQL', async () => {
    const f = fixture();
    await expect(
      f.uc.execute('2', { key: 'changed' } as never, f.actor),
    ).rejects.toThrow('ai_provider:invalid_catalog');
    expect(f.source.transaction).not.toHaveBeenCalled();
  });
  it('rejects a nonexistent catalog instead of creating it during update', async () => {
    const f = fixture();
    f.catalogRepo.findOneBy.mockResolvedValue(null);
    await expect(
      f.uc.execute('2', { name: 'Missing' }, f.actor),
    ).rejects.toThrow('ai_provider:catalog_not_found');
    expect(f.catalogRepo.save).not.toHaveBeenCalled();
  });
  it('denies revoked current modules even in an inherited transaction', async () => {
    const f = fixture();
    f.setAdmin(false);
    f.setModule(false);
    await expect(
      f.uc.execute(
        '2',
        { name: 'Forbidden' },
        { ...f.actor, transaction: f.manager },
      ),
    ).rejects.toThrow('core:module_access_required');
    expect(f.catalogRepo.findOneBy).not.toHaveBeenCalled();
  });
  it('does not reset the coordinator deadline or open a nested transaction', async () => {
    const f = fixture();
    await f.uc.execute(
      '2',
      { name: 'Inherited' },
      { ...f.actor, transaction: f.manager },
    );
    expect(f.source.transaction).not.toHaveBeenCalled();
    expect(f.trace.filter((value) => value.startsWith('SET LOCAL'))).toEqual(
      [],
    );
  });
  it('rejects empty normalized keys and oversized names', async () => {
    const f = fixture();
    for (const dto of [
      { key: '  ', name: 'Blank' },
      { key: 'valid', name: 'x'.repeat(129) },
    ])
      await expect(f.uc.execute(undefined, dto, f.actor)).rejects.toThrow(
        'ai_provider:invalid_catalog',
      );
    expect(f.catalogRepo.save).not.toHaveBeenCalled();
  });
  it.each(['gemini', 'openai'])(
    'rejects retired Web flags for %s before SQL',
    async (key) => {
      const f = fixture();
      await expect(
        f.uc.execute(
          undefined,
          {
            key,
            name: key,
            can_use_token_plan_web: true,
          } as never,
          f.actor,
        ),
      ).rejects.toThrow('ai_provider:invalid_catalog');
      await expect(
        f.uc.execute('2', { can_use_token_plan_web: true } as never, f.actor),
      ).rejects.toThrow('ai_provider:invalid_catalog');
      expect(f.source.transaction).not.toHaveBeenCalled();
      expect(f.catalogRepo.save).not.toHaveBeenCalled();
    },
  );
});
