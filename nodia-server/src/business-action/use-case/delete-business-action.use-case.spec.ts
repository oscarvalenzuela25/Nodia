import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteBusinessActionUseCase } from './delete-business-action.use-case.js';
import type { BusinessActionService } from '../business-action.service.js';

describe('DeleteBusinessActionUseCase', () => {
  let useCase: DeleteBusinessActionUseCase;
  let businessActionServiceMock: Partial<BusinessActionService>;

  beforeEach(() => {
    businessActionServiceMock = {
      remove: vi.fn(),
    };
    useCase = new DeleteBusinessActionUseCase(
      businessActionServiceMock as BusinessActionService,
    );
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call businessActionService.remove with id and return response', async () => {
    const id = '1';
    const response = {
      message: `BusinessAction with ID "${id}" has been deactivated successfully`,
    };

    vi.mocked(businessActionServiceMock.remove!).mockResolvedValue(response);

    const result = await useCase.execute(id);

    expect(businessActionServiceMock.remove).toHaveBeenCalledTimes(1);
    expect(businessActionServiceMock.remove).toHaveBeenCalledWith(id);
    expect(result).toEqual(response);
  });
});
