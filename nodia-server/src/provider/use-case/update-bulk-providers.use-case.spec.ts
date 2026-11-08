import type { EntityManager, Repository } from 'typeorm';
import type { Provider } from '../entities/provider.entity.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateBulkProvidersUseCase } from './update-bulk-providers.use-case.js';
import { ProviderService } from '../provider.service.js';
import type { BulkUpdateProviderDto } from '../dto/bulk-update-provider.dto.js';

describe('UpdateBulkProvidersUseCase', () => {
  let useCase: UpdateBulkProvidersUseCase;
  let providerServiceMock: Partial<ProviderService>;

  beforeEach(() => {
    providerServiceMock = {
      updateBulk: vi.fn(),
    };
    useCase = new UpdateBulkProvidersUseCase(
      providerServiceMock as ProviderService,
    );
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should normalize names to lowercase and call providerService.updateBulk', async () => {
    const bulkDto: BulkUpdateProviderDto = {
      items: [
        {
          id: '1',
          name: '  PROVEEDOR ACTUALIZADO  ',
          tax: 10,
          is_active: false,
        },
      ],
    };

    const mockUpdated = [
      {
        id: '1',
        business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
        name: 'proveedor actualizado',
        tax: 10,
        fields: {},
        is_active: false,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    vi.mocked(providerServiceMock.updateBulk!).mockResolvedValue(
      mockUpdated as any,
    );

    const result = await useCase.execute(bulkDto);

    expect(bulkDto.items[0].name).toBe('proveedor actualizado');
    expect(providerServiceMock.updateBulk).toHaveBeenCalledTimes(1);
    expect(providerServiceMock.updateBulk).toHaveBeenCalledWith(
      bulkDto,
      undefined,
    );
    expect(result).toEqual(mockUpdated);
  });
});

function persistenceFixture() {
  const origin = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    destination = '22222222-2222-4222-8222-222222222222';
  let state = [
      { id: '1', business_id: origin, name: 'One' },
      { id: '2', business_id: origin, name: 'Two' },
    ],
    blocked = '',
    changed = false,
    missing = false;
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('authority_locks')) return [{ authority_locks: 9 }];
    if (sql.includes('FROM users u JOIN auth_sessions'))
      return [{ actorId: '1', sessionId: origin, isSuperAdmin: false }];
    if (sql.startsWith('SELECT id::text,business_id'))
      return state.map((row) => ({ id: row.id, business_id: row.business_id }));
    if (sql.includes('FROM businesses'))
      return missing ? [] : (params[0] as string[]).map((id) => ({ id }));
    if (sql.includes('AS product_count'))
      return (params[0] as string[]).map((id) => ({
        provider_id: id,
        product_count: id === blocked ? '1' : '0',
        invoice_count: '0',
      }));
    throw Error('Unexpected persistence query');
  });
  const getMany = vi.fn(async () =>
    state.map((row) => ({
      ...row,
      ...(changed ? { business_id: destination } : {}),
    })),
  );
  const qb = {
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    setLock: vi.fn().mockReturnThis(),
    getMany,
  };
  const save = vi.fn(async (rows) => {
    state = structuredClone(rows);
    return rows;
  });
  const manager = {
    query,
    queryRunner: { isTransactionActive: true },
    getRepository: () => ({ createQueryBuilder: () => qb, save }),
  } as unknown as EntityManager;
  const transaction = vi.fn(async (work) => work(manager));
  const service = new ProviderService({
    manager: { transaction },
  } as unknown as Repository<Provider>);
  const realUseCase = new UpdateBulkProvidersUseCase(service);
  const uc = {
    execute: (dto: BulkUpdateProviderDto) =>
      realUseCase.execute(dto, { userId: '1', sessionId: origin }),
  };
  return {
    origin,
    destination,
    query,
    getMany,
    qb,
    save,
    transaction,
    uc,
    state: () => state,
    block: (id: string) => {
      blocked = id;
    },
    change: () => {
      changed = true;
    },
    missing: () => {
      missing = true;
    },
  };
}
describe('bulk provider integrity through the native use case and real persistence rules', () => {
  it('locks all business scopes before suppliers and validates transfers in one set query preserving response order', async () => {
    const f = persistenceFixture(),
      result = await f.uc.execute({
        items: [
          { id: '2', business_id: f.destination, name: ' Updated Two ' },
          { id: '1', business_id: f.destination },
        ],
      });
    expect(result.map((row) => row.id)).toEqual(['2', '1']);
    expect(result[0].name).toBe('updated two');
    expect(f.save).toHaveBeenCalledTimes(1);
    const scopes = f.query.mock.calls.findIndex(([sql]) =>
        sql.includes('FROM businesses'),
      ),
      references = f.query.mock.calls.findIndex(([sql]) =>
        sql.includes('AS product_count'),
      );
    expect(f.query.mock.invocationCallOrder[scopes]).toBeLessThan(
      f.getMany.mock.invocationCallOrder[0],
    );
    expect(f.getMany.mock.invocationCallOrder[0]).toBeLessThan(
      f.query.mock.invocationCallOrder[references],
    );
    expect(
      f.query.mock.calls.filter(([sql]) => sql.includes('AS product_count')),
    ).toHaveLength(1);
  });
  it('rejects an incompatible later transfer before mutating or saving any provider', async () => {
    const f = persistenceFixture();
    f.block('2');
    await expect(
      f.uc.execute({
        items: [
          { id: '1', name: 'Must roll back' },
          { id: '2', business_id: f.destination },
        ],
      }),
    ).rejects.toThrow('Provider cannot move');
    expect(f.save).not.toHaveBeenCalled();
    expect(f.state()[0].name).toBe('One');
  });
  it.each(['1', '01'])(
    'rejects duplicate semantic ID %s before opening a transaction',
    async (duplicateId) => {
      const f = persistenceFixture();
      await expect(
        f.uc.execute({
          items: [
            { id: '1', name: 'First' },
            { id: duplicateId, name: 'Second' },
          ],
        }),
      ).rejects.toThrow('Duplicate');
      expect(f.transaction).not.toHaveBeenCalled();
    },
  );
  it('rejects changed scope after the ordered locks instead of taking new locks out of order', async () => {
    const f = persistenceFixture();
    f.change();
    await expect(
      f.uc.execute({
        items: [
          { id: '1', business_id: f.destination },
          { id: '2', business_id: f.destination },
        ],
      }),
    ).rejects.toThrow('Provider scope changed');
    expect(f.save).not.toHaveBeenCalled();
  });
  it('canonicalizes equivalent UUID business scopes before cardinality checks and locks', async () => {
    const f = persistenceFixture();
    await f.uc.execute({
      items: [
        { id: '1', business_id: f.origin.toUpperCase() },
        { id: '2', business_id: f.origin },
      ],
    });
    const call = f.query.mock.calls.find(([sql]) =>
      sql.includes('FROM businesses'),
    )!;
    expect(call[1][0]).toEqual([f.origin]);
  });
  it('rejects a missing destination without saving any selected provider', async () => {
    const f = persistenceFixture();
    f.missing();
    await expect(
      f.uc.execute({
        items: [
          { id: '1', business_id: f.destination },
          { id: '2', business_id: f.destination },
        ],
      }),
    ).rejects.toThrow('business:resource_not_found');
    expect(f.save).not.toHaveBeenCalled();
  });
});
