import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveAiApiKeyUseCase } from './save-ai-api-key.use-case.js';
import { AiApiKey } from '../entities/ai-api-key.entity.js';
import { decryptSecret } from '../helpers/ai-key-crypto.helper.js';
import { configurationFixture } from '../../../test/fixtures/ai-provider-configuration.fixture.js';

describe('SaveAiApiKeyUseCase', () => {
  beforeEach(() => vi.stubEnv('AI_SECRET_MASTER_KEY', 'a'.repeat(64)));
  afterEach(() => vi.unstubAllEnvs());
  const fixture = () => {
    const f = configurationFixture();
    const key = Object.assign(new AiApiKey(), {
      id: '9007199254740994',
      provider_id: f.existing.id,
      label: 'Synthetic key',
      is_active: true,
      is_selected: true,
      sort_order: 0,
      display_hint: '...test',
      health_state: 'untested',
    });
    const keys = [key];
    const repo = {
      findOneBy: vi.fn(async ({ id }: { id: string }) => {
        f.trace.push('key-read');
        return keys.find((k) => k.id === id) ?? null;
      }),
      countBy: vi.fn(async () => keys.filter((k) => k.is_active).length),
      create: vi.fn((value: Partial<AiApiKey>) =>
        Object.assign(new AiApiKey(), value),
      ),
      save: vi.fn(async (value: AiApiKey) => {
        f.trace.push('key-write');
        return Object.assign(value, { id: value.id ?? '9007199254740995' });
      }),
      update: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
      find: vi.fn(async () => keys.filter((k) => k.is_active)),
    };
    const original = vi
      .mocked(f.manager.getRepository)
      .getMockImplementation()!;
    vi.mocked(f.manager.getRepository).mockImplementation((entity: unknown) =>
      entity === AiApiKey ? repo : (original(entity as never) as never),
    );
    return {
      ...f,
      key,
      keys,
      repo,
      uc: new SaveAiApiKeyUseCase(f.source),
      dto: {
        provider_id: f.existing.id,
        label: 'Synthetic create',
        secret: 'synthetic-private-key',
      },
    };
  };

  it('locks current authority before resolving native keys and encrypts only inside that transaction', async () => {
    const f = fixture();
    const result = await f.uc.execute(undefined, f.dto, f.actor);
    expect(
      f.trace.findIndex((t) => t.includes('LOCK TABLE actions')),
    ).toBeLessThan(f.trace.indexOf('provider-read'));
    expect(decryptSecret(f.repo.save.mock.calls[0][0].secret_ciphertext)).toBe(
      f.dto.secret,
    );
    expect(result).not.toHaveProperty('secret_ciphertext');
    expect(result).not.toHaveProperty('secret_fingerprint');
    expect(JSON.stringify(result)).not.toContain(f.dto.secret);
  });
  it('never leaks unrecognized columns or loaded provider relations', async () => {
    const f = fixture();
    Object.assign(f.key, {
      provider: { fields: { secret: 'private' } },
      events: [{ secret: 'private' }],
      extra: 'private',
    });
    const result = await f.uc.execute(
      f.key.id,
      { label: 'Corrected' },
      f.actor,
    );
    expect(result).not.toHaveProperty('provider');
    expect(result).not.toHaveProperty('events');
    expect(result).not.toHaveProperty('extra');
  });
  it('inherits the receipt manager without opening or resetting a transaction', async () => {
    const f = fixture();
    await f.uc.execute(
      f.key.id,
      { label: 'Updated' },
      { ...f.actor, transaction: f.manager },
    );
    expect(f.source.transaction).not.toHaveBeenCalled();
    expect(f.trace.some((t) => t.startsWith('SET LOCAL'))).toBe(false);
  });
  it('rejects an inherited active manager without actual authority locks', async () => {
    const f = fixture();
    f.setAuthorityLocks(false);
    await expect(
      f.uc.execute(
        f.key.id,
        { label: 'Updated' },
        { ...f.actor, transaction: f.manager },
      ),
    ).rejects.toThrow('authority_transaction_required');
    expect(f.repo.save).not.toHaveBeenCalled();
  });
  it('rejects a revoked session before reading or encrypting keys', async () => {
    const f = fixture();
    f.setSession(false);
    await expect(f.uc.execute(undefined, f.dto, f.actor)).rejects.toThrow(
      'session_expired',
    );
    expect(f.providerRepo.findOne).not.toHaveBeenCalled();
    expect(f.repo.save).not.toHaveBeenCalled();
  });
  it('rejects a manager without ai:manage and permits the actual permission', async () => {
    const f = fixture();
    f.setAdmin(false);
    f.setPermission(false);
    await expect(f.uc.remove(f.key.id, f.actor)).rejects.toThrow(
      'manage_required',
    );
    expect(f.repo.findOneBy).not.toHaveBeenCalled();
    f.setPermission(true);
    await f.uc.execute(f.key.id, { label: 'Allowed' }, f.actor);
    expect(f.repo.save).toHaveBeenCalledOnce();
  });
  it('requires an actual provider and catalog API capability on create', async () => {
    const f = fixture();
    f.catalog.can_use_api_key = false;
    await expect(f.uc.execute(undefined, f.dto, f.actor)).rejects.toThrow(
      'catálogo',
    );
    expect(f.repo.save).not.toHaveBeenCalled();
    f.providerRepo.findOne.mockResolvedValueOnce(null as never);
    await expect(f.uc.execute(undefined, f.dto, f.actor)).rejects.toThrow(
      'not_found',
    );
  });
  it('preserves existing metadata edits even if the catalog API capability was disabled later', async () => {
    const f = fixture();
    f.catalog.can_use_api_key = false;
    await f.uc.execute(f.key.id, { label: 'Historical' }, f.actor);
    expect(f.repo.save.mock.calls[0][0].secret_ciphertext).toBeUndefined();
  });
  it('forces a sole active key selected even when inactive history exists', async () => {
    const f = fixture();
    f.keys.push({ ...f.key, id: '9', is_active: false } as AiApiKey);
    await f.uc.execute(f.key.id, { is_selected: false }, f.actor);
    expect(f.repo.save.mock.calls[0][0].is_selected).toBe(true);
  });
  it('selects the first active key among inactive historical rows', async () => {
    const f = fixture();
    f.key.is_active = false;
    await f.uc.execute(undefined, { ...f.dto, is_selected: false }, f.actor);
    expect(f.repo.save.mock.calls[0][0].is_selected).toBe(true);
  });
  it('preserves the explicit no-selection choice when multiple active keys exist', async () => {
    const f = fixture();
    f.keys.push({ ...f.key, id: '9' } as AiApiKey);
    await f.uc.execute(f.key.id, { is_selected: false }, f.actor);
    expect(f.repo.save.mock.calls[0][0].is_selected).toBe(false);
  });
  it('resets previous selection before storing a new selection', async () => {
    const f = fixture();
    await f.uc.execute(undefined, { ...f.dto, is_selected: true }, f.actor);
    expect(f.repo.update).toHaveBeenCalledWith(
      { provider_id: f.existing.id, is_selected: true },
      { is_selected: false },
    );
    expect(f.repo.update.mock.invocationCallOrder[0]).toBeLessThan(
      f.repo.save.mock.invocationCallOrder[0],
    );
  });
  it('rejects selecting an inactive existing key but preserves create normalization', async () => {
    const f = fixture();
    f.key.is_active = false;
    await expect(
      f.uc.execute(f.key.id, { is_selected: true }, f.actor),
    ).rejects.toThrow('inactiva');
    await f.uc.execute(
      undefined,
      { ...f.dto, is_active: false, is_selected: true },
      f.actor,
    );
    expect(f.repo.save.mock.calls[0][0].is_selected).toBe(false);
  });
  it('normalizes the sole remaining active key after delete among inactive history', async () => {
    const f = fixture();
    await f.uc.remove(f.key.id, f.actor);
    expect(f.repo.delete).toHaveBeenCalledWith({
      id: f.key.id,
      provider_id: f.existing.id,
    });
    expect(f.repo.update).toHaveBeenCalledWith(
      { id: f.key.id },
      { is_selected: true },
    );
  });
  it('converts duplicate constraints to a safe conflict without the SQL or secret', async () => {
    const f = fixture();
    f.repo.save.mockRejectedValueOnce({ code: '23505', detail: f.dto.secret });
    await expect(f.uc.execute(undefined, f.dto, f.actor)).rejects.toMatchObject(
      { status: 409 },
    );
  });
  it('propagates unexpected storage failure for transaction rollback', async () => {
    const f = fixture();
    f.repo.save.mockRejectedValueOnce(
      new Error('synthetic storage unavailable'),
    );
    await expect(f.uc.execute(undefined, f.dto, f.actor)).rejects.toThrow(
      'storage unavailable',
    );
  });
  it.each(['1e3', '0', '9223372036854775808', '../1'])(
    'rejects invalid key identity %s before transaction',
    async (id) => {
      const f = fixture();
      await expect(f.uc.remove(id, f.actor)).rejects.toThrow();
      expect(f.source.transaction).not.toHaveBeenCalled();
    },
  );
  it.each([
    { secret: null },
    { provider_id: '4' },
    { secret_ciphertext: 'invented' },
    { label: '' },
    { is_active: null },
  ])('rejects malformed update %j before transaction', async (dto) => {
    const f = fixture();
    await expect(
      f.uc.execute(f.key.id, dto as never, f.actor),
    ).rejects.toThrow();
    expect(f.source.transaction).not.toHaveBeenCalled();
  });
});
