import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAllProvidersUseCase } from './get-all-providers.use-case.js';
import type { ProviderService } from '../provider.service.js';
import type { GetProvidersDto } from '../dto/get-providers.dto.js';

describe('GetAllProvidersUseCase', () => {
  let useCase: GetAllProvidersUseCase;
  let providerServiceMock: Partial<ProviderService>;

  beforeEach(() => {
    providerServiceMock = {
      findAll: vi.fn(),
    };
    useCase = new GetAllProvidersUseCase(providerServiceMock as ProviderService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call providerService.findAll with queryParams and return result', async () => {
    const queryParams: GetProvidersDto = {
      page: 1,
      limit: 10,
      all: false,
      includes: true,
    };

    const mockResponse = {
      data: [
        {
          id: '1',
          business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
          name: 'Distribuidora Central',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      meta: {
        page: 1,
        limit: 10,
        total_items: 1,
        total_pages: 1,
      },
    };

    vi.mocked(providerServiceMock.findAll!).mockResolvedValue(mockResponse as any);

    const result = await useCase.execute(queryParams);

    expect(providerServiceMock.findAll).toHaveBeenCalledTimes(1);
    expect(providerServiceMock.findAll).toHaveBeenCalledWith(queryParams);
    expect(result).toEqual(mockResponse);
  });
});
