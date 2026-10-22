import { describe, it, expect, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { SaveBusinessActionUseCase } from './save-business-action.use-case.js';
import { CreateBusinessActionUseCase } from './create-business-action.use-case.js';
import { UpdateBusinessActionUseCase } from './update-business-action.use-case.js';
import { DeleteBusinessActionUseCase } from './delete-business-action.use-case.js';
import type { BusinessActionService } from '../business-action.service.js';
import type { RedisService } from '../../common/redis/redis.service.js';
import type { TranslationService } from '../../translation/translation.service.js';
import { actorFixture } from '../../authorization/use-case/authority.fixture.js';
import { withCoreAuthorityLock } from '../../authorization/core-authority-transaction.js';

function fixture() {
  let value = {
    id: '7',
    key: 'synthetic',
    is_active: false,
    has_description: true,
  };
  const repository = {
    findOneBy: vi.fn(async () => ({ ...value })),
    create: vi.fn((data) => data),
    save: vi.fn(async (data) => {
      value = { ...value, ...data };
      return value;
    }),
    findOneByOrFail: vi.fn(async () => value),
  };
  const manager = {
    queryRunner: { isTransactionActive: true },
    query: vi.fn(async (sql: string) =>
      sql.includes('AS "actorId"')
        ? [{ actorId: '1', isSuperAdmin: false }]
        : [],
    ),
    getRepository: vi.fn(() => repository),
  };
  const source = {
    transaction: vi.fn(
      async (work: (manager: EntityManager) => Promise<unknown>) =>
        work(manager as unknown as EntityManager),
    ),
  };
  const reader = { findOne: vi.fn(async () => value) };
  const redis = { delByPattern: vi.fn(async () => {}) };
  const translations = { updateTranslations: vi.fn(async () => {}) };
  const writer = new SaveBusinessActionUseCase(
    source as unknown as DataSource,
    reader as unknown as BusinessActionService,
    redis as unknown as RedisService,
    translations as unknown as TranslationService,
  );
  return {
    writer,
    repository,
    manager,
    source,
    reader,
    redis,
    translations,
    actor: actorFixture('1'),
  };
}

describe('Business action native authority writes', () => {
  it('create preserves native key upsert and omitted activity', async () => {
    const f = fixture();
    const saved = await new CreateBusinessActionUseCase(f.writer).execute(
      { key: 'synthetic' },
      f.actor,
    );
    expect(saved.is_active).toBe(false);
    expect(saved.id).toBe('7');
    expect(f.repository.findOneBy).toHaveBeenCalledWith({ key: 'synthetic' });
    expect(f.manager.query.mock.calls[2][0]).toContain('SHARE ROW EXCLUSIVE');
    expect(f.manager.query.mock.calls[3][0]).toContain('AS "actorId"');
  });
  it('update keeps a disabled action disabled when activity was omitted', async () => {
    const f = fixture();
    const saved = await new UpdateBusinessActionUseCase(f.writer).execute(
      '7',
      { has_description: false },
      f.actor,
    );
    expect(saved).toMatchObject({ is_active: false, has_description: false });
    expect(f.redis.delByPattern).toHaveBeenCalledOnce();
  });
  it('delete keeps the row and returns the native deactivation response', async () => {
    const f = fixture();
    const result = await new DeleteBusinessActionUseCase(f.writer).execute(
      '7',
      f.actor,
    );
    expect(result.message).toContain('deactivated successfully');
    expect(f.repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: '7', is_active: false }),
    );
  });
  it('translates with the same transactional manager before any cache call', async () => {
    const f = fixture();
    const translates = [{ key: 'name', es: 'Nombre', en: 'Name' }];
    f.translations.updateTranslations.mockImplementation(async () => {
      expect(f.redis.delByPattern).not.toHaveBeenCalled();
    });
    await f.writer.execute('7', { translates }, f.actor);
    expect(f.translations.updateTranslations).toHaveBeenCalledWith(
      'business_actions',
      '7',
      translates,
      f.manager,
    );
  });
  it('translation failure propagates without post-commit reader or cache success', async () => {
    const f = fixture();
    f.translations.updateTranslations.mockRejectedValue(
      Error('translation unavailable'),
    );
    await expect(
      f.writer.execute(
        '7',
        { translates: [{ key: 'name', es: 'X', en: 'X' }] },
        f.actor,
      ),
    ).rejects.toThrow('translation unavailable');
    expect(f.redis.delByPattern).not.toHaveBeenCalled();
    expect(f.reader.findOne).not.toHaveBeenCalled();
  });
  it('missing row produces no write or cache invalidation', async () => {
    const f = fixture();
    f.repository.findOneBy.mockResolvedValue(null!);
    await expect(f.writer.execute('8', {}, f.actor)).rejects.toMatchObject({
      status: 404,
    });
    expect(f.repository.save).not.toHaveBeenCalled();
    expect(f.redis.delByPattern).not.toHaveBeenCalled();
  });
  it('inherits only an exclusive active frontier without independent commit, timeout reset or Redis', async () => {
    const f = fixture(),
      manager = f.manager as unknown as EntityManager;
    await withCoreAuthorityLock(manager, 1100, async () => {
      const before = f.manager.query.mock.calls.length;
      const result = await f.writer.execute(
        '7',
        { key: 'renamed' },
        { ...f.actor, transaction: manager },
      );
      expect(result.key).toBe('renamed');
      expect(
        f.manager.query.mock.calls.slice(before).map(([sql]) => sql),
      ).toEqual([expect.stringContaining('AS "actorId"')]);
    });
    expect(f.source.transaction).not.toHaveBeenCalled();
    expect(f.reader.findOne).not.toHaveBeenCalled();
    expect(f.redis.delByPattern).not.toHaveBeenCalled();
  });
  it('rejects an unproved manager before reading or saving', async () => {
    const f = fixture();
    await expect(
      f.writer.execute(
        '7',
        {},
        { ...f.actor, transaction: f.manager as unknown as EntityManager },
      ),
    ).rejects.toMatchObject({
      message: 'authorization:exclusive_transaction_required',
    });
    expect(f.manager.query).not.toHaveBeenCalled();
    expect(f.repository.save).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    'removes exclusive proof after scoped callback (throws=%s), even if manager reused',
    async (throws) => {
      const f = fixture(),
        manager = f.manager as unknown as EntityManager;
      await withCoreAuthorityLock(manager, undefined, async () => {
        if (throws) throw Error('rollback');
      }).catch(() => {});
      await expect(
        f.writer.execute('7', {}, { ...f.actor, transaction: manager }),
      ).rejects.toMatchObject({
        message: 'authorization:exclusive_transaction_required',
      });
      expect(f.repository.save).not.toHaveBeenCalled();
    },
  );
  it('rejects a frontier that is no longer an active transaction', async () => {
    const f = fixture(),
      manager = f.manager as unknown as EntityManager;
    await withCoreAuthorityLock(manager, undefined, async () => {
      f.manager.queryRunner.isTransactionActive = false;
      await expect(
        f.writer.execute('7', {}, { ...f.actor, transaction: manager }),
      ).rejects.toMatchObject({
        message: 'authorization:exclusive_transaction_required',
      });
    });
  });
});
