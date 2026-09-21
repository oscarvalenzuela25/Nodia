import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetMyBusinessesUseCase } from './get-my-businesses.use-case.js';
import type { BusinessService } from '../business.service.js';
import type { GetBusinessesDto } from '../dto/get-businesses.dto.js';

describe('GetMyBusinessesUseCase', () => {
  let useCase: GetMyBusinessesUseCase;
  let businessServiceMock: Partial<BusinessService>;

  beforeEach(() => {
    businessServiceMock = {
      findMyBusinesses: vi.fn(),
    };
    useCase = new GetMyBusinessesUseCase(businessServiceMock as BusinessService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call businessService.findMyBusinesses with userId and queryParams', async () => {
    const userId = '100';
    const queryParams: GetBusinessesDto = {
      page: 1,
      limit: 10,
      all: false,
      includes: true,
    };

    const mockResponse = {
      data: [
        {
          id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
          name: 'Mi Panadería',
          owner_id: '100',
          has_description: false,
          is_active: true,
          user_role: 'owner' as const,
          user_position: 'Owner',
          user_action_ids: [],
          collaborators_count: 2,
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

    vi.mocked(businessServiceMock.findMyBusinesses!).mockResolvedValue(mockResponse as any);

    const result = await useCase.execute(userId, queryParams);

    expect(businessServiceMock.findMyBusinesses).toHaveBeenCalledTimes(1);
    expect(businessServiceMock.findMyBusinesses).toHaveBeenCalledWith(userId, queryParams);
    expect(result).toEqual(mockResponse);
  });
});
