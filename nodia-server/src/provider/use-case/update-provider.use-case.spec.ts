import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateProviderUseCase } from './update-provider.use-case.js';
import type { ProviderService } from '../provider.service.js';
import type { UpdateProviderDto } from '../dto/update-provider.dto.js';

describe('UpdateProviderUseCase', () => {
  let useCase: UpdateProviderUseCase;
  let providerServiceMock: Partial<ProviderService>;

  beforeEach(() => {
    providerServiceMock = {
      update: vi.fn(),
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
    expect(providerServiceMock.update).toHaveBeenCalledWith(id, {
      name: 'proveedor actualizado',
      is_active: false,
    });
    expect(result).toEqual(updated);
  });
});
