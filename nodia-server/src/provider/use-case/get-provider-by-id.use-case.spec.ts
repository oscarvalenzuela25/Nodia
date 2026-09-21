import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetProviderByIdUseCase } from './get-provider-by-id.use-case.js';
import type { ProviderService } from '../provider.service.js';

describe('GetProviderByIdUseCase', () => {
  let useCase: GetProviderByIdUseCase;
  let providerServiceMock: Partial<ProviderService>;

  beforeEach(() => {
    providerServiceMock = {
      findOne: vi.fn(),
    };
    useCase = new GetProviderByIdUseCase(providerServiceMock as ProviderService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call providerService.findOne with id and return provider', async () => {
    const id = '1';
    const mockProvider = {
      id,
      business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
      name: 'Distribuidora Central',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    vi.mocked(providerServiceMock.findOne!).mockResolvedValue(mockProvider as any);

    const result = await useCase.execute(id);

    expect(providerServiceMock.findOne).toHaveBeenCalledTimes(1);
    expect(providerServiceMock.findOne).toHaveBeenCalledWith(id);
    expect(result).toEqual(mockProvider);
  });
});
