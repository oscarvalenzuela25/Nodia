import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateBusinessActionUseCase } from './update-business-action.use-case.js';
import type { BusinessActionService } from '../business-action.service.js';
import type { UpdateBusinessActionDto } from '../dto/update-business-action.dto.js';

describe('UpdateBusinessActionUseCase', () => {
  let useCase: UpdateBusinessActionUseCase;
  let businessActionServiceMock: Partial<BusinessActionService>;

  beforeEach(() => {
    businessActionServiceMock = {
      update: vi.fn(),
    };
    useCase = new UpdateBusinessActionUseCase(
      businessActionServiceMock as BusinessActionService,
    );
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call businessActionService.update with id and dto and return updated business action', async () => {
    const id = '1';
    const dto: UpdateBusinessActionDto = {
      key: 'products:edit',
      is_active: true,
    };

    const updated = {
      id,
      key: 'products:edit',
      has_description: false,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    vi.mocked(businessActionServiceMock.update!).mockResolvedValue(updated as any);

    const result = await useCase.execute(id, dto);

    expect(businessActionServiceMock.update).toHaveBeenCalledTimes(1);
    expect(businessActionServiceMock.update).toHaveBeenCalledWith(id, dto);
    expect(result).toEqual(updated);
  });
});
