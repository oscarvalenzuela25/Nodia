import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateBulkProvidersUseCase } from './create-bulk-providers.use-case.js';
import type { ProviderService } from '../provider.service.js';
import type { BulkCreateProviderDto } from '../dto/bulk-create-provider.dto.js';

describe('CreateBulkProvidersUseCase', () => {
  let useCase: CreateBulkProvidersUseCase;
  let providerServiceMock: Partial<ProviderService>;

  beforeEach(() => {
    providerServiceMock = {
      createBulk: vi.fn(),
    };
    useCase = new CreateBulkProvidersUseCase(providerServiceMock as ProviderService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should normalize names to lowercase and call providerService.createBulk', async () => {
    const bulkDto: BulkCreateProviderDto = {
      items: [
        {
          business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
          name: '  PROVEEDOR CENTRAL  ',
          tax: 19,
          fields: {
            code: { value: 'COD', instructions: 'columna codigo' },
          },
          is_active: true,
        },
      ],
    };

    const mockCreated = [
      {
        id: '1',
        ...bulkDto.items[0],
        name: 'proveedor central',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    vi.mocked(providerServiceMock.createBulk!).mockResolvedValue(mockCreated as any);

    const result = await useCase.execute(bulkDto);

    expect(bulkDto.items[0].name).toBe('proveedor central');
    expect(providerServiceMock.createBulk).toHaveBeenCalledTimes(1);
    expect(providerServiceMock.createBulk).toHaveBeenCalledWith(bulkDto);
    expect(result).toEqual(mockCreated);
  });
});
