import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateActionUseCase } from './update-action.use-case.js';
import type { ActionService } from '../action.service.js';
import type { UpdateActionDto } from '../dto/update-action.dto.js';

describe('UpdateActionUseCase', () => {
  let useCase: UpdateActionUseCase;
  let actionServiceMock: Partial<ActionService>;

  beforeEach(() => {
    actionServiceMock = {
      update: vi.fn(),
    };
    useCase = new UpdateActionUseCase(actionServiceMock as ActionService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call actionService.update with id and dto and return updated action', async () => {
    const id = '1';
    const dto: UpdateActionDto = {
      description: 'Updated description',
      is_active: false,
    };

    const updatedAction = {
      id,
      key: 'roles.delete',
      module_id: '1',
      description: 'Updated description',
      is_active: false,
      created_at: new Date(),
      updated_at: new Date(),
      action_roles: [],
      module: null,
    };

    vi.mocked(actionServiceMock.update!).mockResolvedValue(updatedAction as any);

    const result = await useCase.execute(id, dto);

    expect(actionServiceMock.update).toHaveBeenCalledTimes(1);
    expect(actionServiceMock.update).toHaveBeenCalledWith(id, dto);
    expect(result).toEqual(updatedAction);
  });
});
