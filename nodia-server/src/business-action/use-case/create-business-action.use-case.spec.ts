import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateBusinessActionUseCase } from './create-business-action.use-case.js';
import type { BusinessActionService } from '../business-action.service.js';
import type { CreateBusinessActionDto } from '../dto/create-business-action.dto.js';

describe('CreateBusinessActionUseCase', () => {
  let useCase: CreateBusinessActionUseCase;
  let businessActionServiceMock: Partial<BusinessActionService>;

  beforeEach(() => {
    businessActionServiceMock = {
      create: vi.fn(),
    };
    useCase = new CreateBusinessActionUseCase(
      businessActionServiceMock as BusinessActionService,
    );
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call businessActionService.create with dto and return created business action', async () => {
    const dto: CreateBusinessActionDto = {
      key: 'products:create',
      has_description: true,
      is_active: true,
      translates: [
        { locale: 'es', key: 'name', value: 'Crear productos' },
        { locale: 'en', key: 'name', value: 'Create products' },
      ],
    };

    const created = {
      id: '1',
      key: 'products:create',
      has_description: true,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    vi.mocked(businessActionServiceMock.create!).mockResolvedValue(created as any);

    const result = await useCase.execute(dto);

    expect(businessActionServiceMock.create).toHaveBeenCalledTimes(1);
    expect(businessActionServiceMock.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(created);
  });
});
