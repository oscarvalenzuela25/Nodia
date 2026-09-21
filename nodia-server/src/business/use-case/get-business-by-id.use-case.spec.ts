import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetBusinessByIdUseCase } from './get-business-by-id.use-case.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { BusinessService } from '../business.service.js';

describe('GetBusinessByIdUseCase', () => {
  let useCase: GetBusinessByIdUseCase;
  let businessServiceMock: Partial<BusinessService>;

  beforeEach(() => {
    businessServiceMock = {
      findOne: vi.fn(),
    };
    useCase = new GetBusinessByIdUseCase(businessServiceMock as BusinessService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call businessService.findOne with id and userId and return the business', async () => {
    const businessId = 'b7b80a11-827c-4712-9c17-9150d0325d7b';
    const userId = '100';

    const mockBusiness = {
      id: businessId,
      name: 'Mi Negocio',
      owner_id: userId,
      has_description: false,
      is_active: true,
      user_role: 'owner' as const,
      user_position: 'Owner',
      user_action_ids: [],
      created_at: new Date(),
      updated_at: new Date(),
    };

    vi.mocked(businessServiceMock.findOne!).mockResolvedValue(mockBusiness as any);

    const result = await useCase.execute(businessId, userId);

    expect(businessServiceMock.findOne).toHaveBeenCalledTimes(1);
    expect(businessServiceMock.findOne).toHaveBeenCalledWith(businessId, userId);
    expect(result).toEqual(mockBusiness);
  });

  it('should propagate ForbiddenException if user is neither owner nor collaborator', async () => {
    const businessId = 'b7b80a11-827c-4712-9c17-9150d0325d7b';
    const unauthorizedUserId = '999';

    vi.mocked(businessServiceMock.findOne!).mockRejectedValue(
      new ForbiddenException('You do not have access to this business'),
    );

    await expect(useCase.execute(businessId, unauthorizedUserId)).rejects.toThrow(
      ForbiddenException,
    );
    expect(businessServiceMock.findOne).toHaveBeenCalledWith(
      businessId,
      unauthorizedUserId,
    );
  });

  it('should propagate NotFoundException if business does not exist', async () => {
    const nonExistentId = 'b7b80a11-827c-4712-9c17-000000000000';
    const userId = '100';

    vi.mocked(businessServiceMock.findOne!).mockRejectedValue(
      new NotFoundException(`Business with ID "${nonExistentId}" not found`),
    );

    await expect(useCase.execute(nonExistentId, userId)).rejects.toThrow(
      NotFoundException,
    );
  });
});
