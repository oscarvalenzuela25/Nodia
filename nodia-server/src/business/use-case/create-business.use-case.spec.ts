import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateBusinessUseCase } from './create-business.use-case.js';
import type { BusinessService } from '../business.service.js';
import type { CreateBusinessDto } from '../dto/create-business.dto.js';

describe('CreateBusinessUseCase', () => {
  let useCase: CreateBusinessUseCase;
  let businessServiceMock: Partial<BusinessService>;

  beforeEach(() => {
    businessServiceMock = {
      create: vi.fn(),
    };
    useCase = new CreateBusinessUseCase(businessServiceMock as BusinessService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call businessService.create with userId and dto, returning created business', async () => {
    const userId = '100';
    const dto: CreateBusinessDto = {
      name: 'Nuevo Negocio',
      has_description: false,
    };

    const created = {
      id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
      name: dto.name,
      owner_id: userId,
      has_description: false,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    vi.mocked(businessServiceMock.create!).mockResolvedValue(created as any);

    const result = await useCase.execute(userId, dto);

    expect(businessServiceMock.create).toHaveBeenCalledTimes(1);
    expect(businessServiceMock.create).toHaveBeenCalledWith(userId, dto);
    expect(result).toEqual(created);
  });
});
