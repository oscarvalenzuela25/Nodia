import type { EntityManager, Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { ProviderService } from './provider.service.js';
import { Provider } from './entities/provider.entity.js';
import { UpdateBulkProvidersUseCase } from './use-case/update-bulk-providers.use-case.js';
import { UpdateProviderUseCase } from './use-case/update-provider.use-case.js';
import { ProviderContactService } from '../provider-contact/provider-contact.service.js';
import type { ProviderContact } from '../provider-contact/entities/provider-contact.entity.js';

const origin = '11111111-1111-4111-8111-111111111111';
const destination = '22222222-2222-4222-8222-222222222222';
const actor = {
  userId: '7',
  sessionId: '77777777-7777-4777-8777-777777777777',
};

function fixture(visible: string[] = [origin], superAdmin = false) {
  const save = vi.fn(async (rows: unknown) => rows);
  const create = vi.fn((rows: unknown) => rows);
  const provider = { id: '1', business_id: origin, name: 'Before' };
  let providerReads = 0;
  let transferred = false;
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('authority_locks')) return [{ authority_locks: 9 }];
    if (sql.includes('FROM users u JOIN auth_sessions'))
      return [
        {
          actorId: actor.userId,
          sessionId: actor.sessionId,
          isSuperAdmin: superAdmin,
        },
      ];
    if (sql.includes('FROM businesses WHERE'))
      return (params[0] as string[]).map((id) => ({ id }));
    if (sql.includes('FROM businesses business'))
      return (params[0] as string[])
        .filter((id) => superAdmin || visible.includes(id))
        .map((id) => ({ id }));
    if (sql.startsWith('SELECT id::text,business_id'))
      return [{ id: '1', business_id: origin }];
    if (sql.startsWith('SELECT business_id::text FROM providers')) {
      providerReads++;
      return [
        {
          business_id: transferred && providerReads > 1 ? destination : origin,
        },
      ];
    }
    if (sql.includes('AS product_count'))
      return [{ provider_id: '1', product_count: '0', invoice_count: '0' }];
    throw new Error('Unexpected synthetic persistence query');
  });
  const builder = {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    setLock: vi.fn().mockReturnThis(),
    getMany: vi.fn(async () => [{ ...provider }]),
    getOne: vi.fn(async () => ({ ...provider })),
  };
  const repository = { createQueryBuilder: () => builder, save, create };
  const manager = {
    query,
    queryRunner: { isTransactionActive: true },
    getRepository: () => repository,
  } as unknown as EntityManager;
  Object.assign(repository, { manager });
  const sourceRepository = {
    manager: {
      transaction: async (work: (manager: EntityManager) => Promise<unknown>) =>
        work(manager),
    },
  };
  const service = new ProviderService(
    sourceRepository as unknown as Repository<Provider>,
  );
  const contacts = new ProviderContactService(
    sourceRepository as unknown as Repository<ProviderContact>,
    sourceRepository as unknown as Repository<Provider>,
  );
  return {
    service,
    contacts,
    manager,
    save,
    create,
    builder,
    query,
    transfer: () => {
      transferred = true;
    },
  };
}

describe('provider access at native write boundaries', () => {
  it('rejects a foreign bulk source before locking suppliers or saving any selected value', async () => {
    const f = fixture([]);
    await expect(
      new UpdateBulkProvidersUseCase(f.service).execute(
        { items: [{ id: '1', name: 'Must not persist' }] },
        actor,
      ),
    ).rejects.toThrow('business:resource_not_found');
    expect(f.builder.getMany).not.toHaveBeenCalled();
    expect(f.save).not.toHaveBeenCalled();
  });

  it('requires access to the destination as well as the current business', async () => {
    const f = fixture([origin]);
    await expect(
      new UpdateProviderUseCase(f.service).execute(
        '1',
        { business_id: destination },
        undefined,
        actor,
      ),
    ).rejects.toThrow('business:resource_not_found');
    expect(f.builder.getOne).not.toHaveBeenCalled();
    expect(f.save).not.toHaveBeenCalled();
  });

  it('validates every bulk-create business before creating or saving entities', async () => {
    const f = fixture([origin]);
    await expect(
      f.service.createBulk(
        {
          items: [
            { business_id: origin, name: 'Allowed' },
            { business_id: destination, name: 'Foreign' },
          ],
        },
        actor,
      ),
    ).rejects.toThrow('business:resource_not_found');
    expect(f.create).not.toHaveBeenCalled();
    expect(f.save).not.toHaveBeenCalled();
  });

  it('lets a current superadministrator transfer an otherwise foreign supplier', async () => {
    const f = fixture([], true);
    const result = await new UpdateBulkProvidersUseCase(f.service).execute(
      { items: [{ id: '1', business_id: destination }] },
      actor,
    );
    expect(result[0].business_id).toBe(destination);
    expect(f.save).toHaveBeenCalledOnce();
  });

  it('rejects a missing actor rather than treating internal persistence as global access', async () => {
    const f = fixture();
    await expect(
      f.service.createBulk({
        items: [{ business_id: origin, name: 'No identity' }],
      }),
    ).rejects.toThrow('auth:session_expired');
    expect(f.save).not.toHaveBeenCalled();
  });

  it('does not enter a contact writer for a supplier in a foreign business', async () => {
    const f = fixture([]),
      writer = vi.fn();
    await expect(
      f.contacts.withAccess('1', actor, undefined, writer),
    ).rejects.toThrow('business:resource_not_found');
    expect(writer).not.toHaveBeenCalled();
  });

  it('uses the same transaction for an authorized contact writer', async () => {
    const f = fixture(),
      writer = vi.fn(async (manager: EntityManager) => manager === f.manager);
    expect(await f.contacts.withAccess('1', actor, undefined, writer)).toBe(
      true,
    );
    expect(writer).toHaveBeenCalledOnce();
  });

  it('rejects a supplier moved after its business was authorized', async () => {
    const f = fixture([origin, destination]),
      writer = vi.fn();
    f.transfer();
    await expect(
      f.contacts.withAccess('1', actor, undefined, writer),
    ).rejects.toThrow('Provider scope changed');
    expect(writer).not.toHaveBeenCalled();
  });
});
