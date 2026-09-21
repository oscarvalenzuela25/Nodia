import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssignBusinessCollaboratorsUseCase } from './assign-business-collaborators.use-case.js';
import type { BusinessService } from '../business.service.js';
import type { AssignCollaboratorsDto } from '../dto/assign-collaborators.dto.js';

describe('AssignBusinessCollaboratorsUseCase', () => {
  let useCase: AssignBusinessCollaboratorsUseCase;
  let businessServiceMock: Partial<BusinessService>;

  beforeEach(() => {
    businessServiceMock = {
      assignCollaborators: vi.fn(),
    };
    useCase = new AssignBusinessCollaboratorsUseCase(
      businessServiceMock as BusinessService,
    );
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call businessService.assignCollaborators with businessId, userId and dto', async () => {
    const businessId = 'b7b80a11-827c-4712-9c17-9150d0325d7b';
    const userId = '100';
    const dto: AssignCollaboratorsDto = {
      users: [
        {
          user_id: '200',
          position: 'Cajero',
          action_ids: ['1', '2'],
        },
      ],
    };

    const mockResult = [
      {
        id: '1',
        business_id: businessId,
        user_id: '200',
        position: 'Cajero',
        action_ids: ['1', '2'],
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    vi.mocked(businessServiceMock.assignCollaborators!).mockResolvedValue(mockResult as any);

    const result = await useCase.execute(businessId, userId, dto);

    expect(businessServiceMock.assignCollaborators).toHaveBeenCalledTimes(1);
    expect(businessServiceMock.assignCollaborators).toHaveBeenCalledWith(
      businessId,
      userId,
      dto,
    );
    expect(result).toEqual(mockResult);
  });
});
