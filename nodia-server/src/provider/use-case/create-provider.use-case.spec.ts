import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateProviderUseCase } from './create-provider.use-case.js';
import type { ProviderService } from '../provider.service.js';
import type { CreateProviderDto } from '../dto/create-provider.dto.js';

describe('CreateProviderUseCase', () => {
  let useCase: CreateProviderUseCase;
  let providerServiceMock: Partial<ProviderService>;

  beforeEach(() => {
    providerServiceMock = {
      create: vi.fn(),
    };
    useCase = new CreateProviderUseCase(providerServiceMock as ProviderService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should normalize name to lowercase and call providerService.create', async () => {
    const dto: CreateProviderDto = {
      business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
      name: '  PROVEEDOR Los Andes S.A.  ',
    };

    const created = {
      id: '1',
      business_id: dto.business_id,
      name: 'proveedor los andes s.a.',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    vi.mocked(providerServiceMock.create!).mockResolvedValue(created as any);

    const result = await useCase.execute(dto);

    expect(dto.name).toBe('proveedor los andes s.a.');
    expect(providerServiceMock.create).toHaveBeenCalledTimes(1);
    expect(providerServiceMock.create).toHaveBeenCalledWith({
      business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
      name: 'proveedor los andes s.a.',
    });
    expect(result).toEqual(created);
  });
});
