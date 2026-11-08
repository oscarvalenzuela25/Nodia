import type { EntityManager, Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { ProviderContactService } from './provider-contact.service.js';
import type { ProviderContact } from './entities/provider-contact.entity.js';
import type { Provider } from '../provider/entities/provider.entity.js';
import { assertBusinessesAccess } from '../business-access/business-access.js';

vi.mock('../business-access/business-access.js', () => ({
  assertBusinessesAccess: vi.fn().mockResolvedValue({
    userId: '1',
    isSuperAdmin: false,
  }),
  resolveBusinessAccess: vi.fn(),
  scopeBusinessQuery: vi.fn(),
}));

describe('ProviderContactService writer parent frontier', () => {
  const business = '7f79295f-bd3b-4a95-bfba-7c071ae15a98';
  const actor = { userId: '1', sessionId: '56d0ba64-c3d7-4f43-a72e-d832177dfef1' };

  it('waits for the exclusive provider frontier before entering the child writer', async () => {
    let release!: () => void;
    let parentRequested!: () => void;
    const requested = new Promise<void>((resolve) => { parentRequested = resolve; });
    const frontier = new Promise<void>((resolve) => { release = resolve; });
    const manager = {
      queryRunner: { isTransactionActive: true },
      query: vi.fn(async (sql: string) => {
        if (sql.endsWith('FOR UPDATE')) {
          parentRequested();
          await frontier;
        }
        return [{ business_id: business }];
      }),
    } as unknown as EntityManager;
    const service = new ProviderContactService(
      {} as Repository<ProviderContact>,
      {} as Repository<Provider>,
    );
    const child = vi.fn(async (transaction: EntityManager) => transaction);
    const pending = service.withAccess('12', actor, manager, child);
    // A premature callback is observable even if the former SHARE query never
    // requested the exclusive frontier, so the previous implementation fails.
    await Promise.race([requested, pending]);
    expect(child).not.toHaveBeenCalled();
    expect(manager.query).toHaveBeenLastCalledWith(
      'SELECT business_id::text FROM providers WHERE id=$1 FOR UPDATE',
      ['12'],
    );
    release();
    await expect(pending).resolves.toBe(manager);
    expect(child).toHaveBeenCalledExactlyOnceWith(manager);
    expect(assertBusinessesAccess).toHaveBeenCalledWith(manager, actor, [business], { lock: true });
  });

  it('does not enter the child writer when the parent scope changed while waiting', async () => {
    const manager = {
      queryRunner: { isTransactionActive: true },
      query: vi.fn()
        .mockResolvedValueOnce([{ business_id: business }])
        .mockResolvedValueOnce([{ business_id: '5d7f26a0-c77b-41e2-b39a-f06297d80c84' }]),
    } as unknown as EntityManager;
    const child = vi.fn();
    const service = new ProviderContactService(
      {} as Repository<ProviderContact>, {} as Repository<Provider>,
    );
    await expect(service.withAccess('12', actor, manager, child)).rejects.toMatchObject({ status: 409 });
    expect(child).not.toHaveBeenCalled();
  });
});
