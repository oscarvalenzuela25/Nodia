import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAllBusinessActionsUseCase } from './get-all-business-actions.use-case.js';
import type { BusinessActionService } from '../business-action.service.js';
import type { GetBusinessActionsDto } from '../dto/get-business-actions.dto.js';

describe('GetAllBusinessActionsUseCase', () => {
  let useCase: GetAllBusinessActionsUseCase;
  let businessActionServiceMock: Partial<BusinessActionService>;

  beforeEach(() => {
    businessActionServiceMock = {
      findAll: vi.fn(),
    };
    useCase = new GetAllBusinessActionsUseCase(
      businessActionServiceMock as BusinessActionService,
    );
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call businessActionService.findAll with queryParams and return the result', async () => {
    const queryParams: GetBusinessActionsDto = {
      page: 1,
      limit: 10,
      all: false,
      includes: true,
    };

    const mockResponse = {
      data: [
        {
          id: '1',
          key: 'business:view',
          has_description: false,
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

    vi.mocked(businessActionServiceMock.findAll!).mockResolvedValue(mockResponse as any);

    const result = await useCase.execute(queryParams);

    expect(businessActionServiceMock.findAll).toHaveBeenCalledTimes(1);
    expect(businessActionServiceMock.findAll).toHaveBeenCalledWith(queryParams);
    expect(result).toEqual(mockResponse);
  });
});
