import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateBusinessUseCase } from './update-business.use-case.js';
import type { BusinessService } from '../business.service.js';
import type { UpdateBusinessDto } from '../dto/update-business.dto.js';

describe('UpdateBusinessUseCase', () => {
  let useCase: UpdateBusinessUseCase;
  let businessServiceMock: Partial<BusinessService>;

  beforeEach(() => {
    businessServiceMock = {
      update: vi.fn(),
    };
    useCase = new UpdateBusinessUseCase(businessServiceMock as BusinessService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call businessService.update with id, userId and dto, returning updated business', async () => {
    const id = 'b7b80a11-827c-4712-9c17-9150d0325d7b';
    const userId = '100';
    const dto: UpdateBusinessDto = {
      name: 'Negocio Renombrado',
      is_active: true,
    };

    const updated = {
      id,
      name: dto.name,
      owner_id: userId,
      has_description: false,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    vi.mocked(businessServiceMock.update!).mockResolvedValue(updated as any);

    const result = await useCase.execute(id, userId, dto);

    expect(businessServiceMock.update).toHaveBeenCalledTimes(1);
    expect(businessServiceMock.update).toHaveBeenCalledWith(id, userId, dto);
    expect(result).toEqual(updated);
  });
});
