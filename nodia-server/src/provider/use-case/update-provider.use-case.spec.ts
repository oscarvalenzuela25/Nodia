import type { EntityManager } from 'typeorm';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateProviderUseCase } from './update-provider.use-case.js';
import type { ProviderService } from '../provider.service.js';
import type { UpdateProviderDto } from '../dto/update-provider.dto.js';

const transactionManager = {} as EntityManager;
describe('UpdateProviderUseCase', () => {
  let useCase: UpdateProviderUseCase;
  let providerServiceMock: Partial<ProviderService>;

  beforeEach(() => {
    providerServiceMock = {
      update: vi.fn(),
      transaction: vi.fn(async (_manager, work) => work(transactionManager)),
      assertBusinessAccess: vi.fn(),
      scopes: vi.fn(async () => [
        { id: '1', business_id: '11111111-1111-4111-8111-111111111111' },
      ]),
      lockProvider: vi.fn(async () => ({
        id: '1',
        business_id: '11111111-1111-4111-8111-111111111111',
      })) as unknown as ProviderService['lockProvider'],
    };
    useCase = new UpdateProviderUseCase(providerServiceMock as ProviderService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should normalize name to lowercase and call providerService.update', async () => {
    const id = '1';
    const dto: UpdateProviderDto = {
      name: '  Proveedor ACTUALIZADO  ',
      is_active: false,
    };

    const updated = {
      id,
      business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
      name: 'proveedor actualizado',
      is_active: dto.is_active,
      created_at: new Date(),
      updated_at: new Date(),
    };

    vi.mocked(providerServiceMock.update!).mockResolvedValue(updated as any);

    const result = await useCase.execute(id, dto);

    expect(dto.name).toBe('proveedor actualizado');
    expect(providerServiceMock.update).toHaveBeenCalledTimes(1);
    expect(providerServiceMock.update).toHaveBeenCalledWith(
      id,
      {
        name: 'proveedor actualizado',
        is_active: false,
      },
      transactionManager,
      undefined,
    );
    expect(result).toEqual(updated);
  });
  it.each(['product_count', 'invoice_count'])(
    'blocks transfer with incompatible %s while retaining the provider',
    async (key) => {
      const query = vi.fn(async () => [
        { product_count: '0', invoice_count: '0', [key]: '1' },
      ]);
      const manager = {
        query,
        queryRunner: { isTransactionActive: true },
      } as unknown as EntityManager;
      const service = {
        transaction: vi.fn(async (_manager, work) => work(manager)),
        scopes: vi.fn(async () => [
          { id: '1', business_id: '11111111-1111-4111-8111-111111111111' },
        ]),
        assertBusinessAccess: vi.fn(),
        lockProvider: vi.fn(async () => ({
          id: '1',
          business_id: '11111111-1111-4111-8111-111111111111',
        })),
        update: vi.fn(),
      };
      const uc = new UpdateProviderUseCase(
        service as unknown as ProviderService,
      );
      await expect(
        uc.execute(
          '1',
          { business_id: '22222222-2222-4222-8222-222222222222' },
          manager,
        ),
      ).rejects.toThrow('Provider cannot move');
      expect(service.update).not.toHaveBeenCalled();
    },
  );
  it('moves an unattached provider using the same manager after checking references under its lock', async () => {
    const query = vi.fn(async () => [
      { product_count: '0', invoice_count: '0' },
    ]);
    const manager = {
      query,
      queryRunner: { isTransactionActive: true },
    } as unknown as EntityManager;
    const service = {
      transaction: vi.fn(async (transaction, work) => work(transaction)),
      scopes: vi.fn(async () => [
        { id: '1', business_id: '11111111-1111-4111-8111-111111111111' },
      ]),
      assertBusinessAccess: vi.fn(),
      lockProvider: vi.fn(async () => ({
        id: '1',
        business_id: '11111111-1111-4111-8111-111111111111',
      })),
      update: vi.fn(async (id, dto) => ({ id, ...dto })),
    };
    const uc = new UpdateProviderUseCase(service as unknown as ProviderService),
      destination = '22222222-2222-4222-8222-222222222222';
    expect(
      await uc.execute('1', { business_id: destination }, manager),
    ).toMatchObject({ id: '1', business_id: destination });
    expect(service.update).toHaveBeenCalledWith(
      '1',
      { business_id: destination },
      manager,
      undefined,
    );
    expect(service.lockProvider.mock.invocationCallOrder[0]).toBeLessThan(
      query.mock.invocationCallOrder[0],
    );
  });
});
