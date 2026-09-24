import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateBulkProvidersUseCase } from './update-bulk-providers.use-case.js';
import type { ProviderService } from '../provider.service.js';
import type { BulkUpdateProviderDto } from '../dto/bulk-update-provider.dto.js';

describe('UpdateBulkProvidersUseCase', () => {
  let useCase: UpdateBulkProvidersUseCase;
  let providerServiceMock: Partial<ProviderService>;

  beforeEach(() => {
    providerServiceMock = {
      updateBulk: vi.fn(),
    };
    useCase = new UpdateBulkProvidersUseCase(providerServiceMock as ProviderService);
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

    vi.mocked(providerServiceMock.updateBulk!).mockResolvedValue(mockUpdated as any);

    const result = await useCase.execute(bulkDto);

    expect(bulkDto.items[0].name).toBe('proveedor actualizado');
    expect(providerServiceMock.updateBulk).toHaveBeenCalledTimes(1);
    expect(providerServiceMock.updateBulk).toHaveBeenCalledWith(bulkDto);
    expect(result).toEqual(mockUpdated);
  });
});
