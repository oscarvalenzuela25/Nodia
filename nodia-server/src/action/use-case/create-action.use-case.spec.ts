import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateActionUseCase } from './create-action.use-case.js';
import type { ActionService } from '../action.service.js';
import type { CreateActionDto } from '../dto/create-action.dto.js';

describe('CreateActionUseCase', () => {
  let useCase: CreateActionUseCase;
  let actionServiceMock: Partial<ActionService>;

  beforeEach(() => {
    actionServiceMock = {
      create: vi.fn(),
    };
    useCase = new CreateActionUseCase(actionServiceMock as ActionService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call actionService.create with dto and return the created action', async () => {
    const dto: CreateActionDto = {
      key: 'roles.delete',
      module_id: '1',
      description: 'Delete roles',
      is_active: true,
    };

    const createdAction = {
      id: '1',
      ...dto,
      created_at: new Date(),
      updated_at: new Date(),
      action_roles: [],
      module: null,
    };

    vi.mocked(actionServiceMock.create!).mockResolvedValue(createdAction as any);

    const result = await useCase.execute(dto);

    expect(actionServiceMock.create).toHaveBeenCalledTimes(1);
    expect(actionServiceMock.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(createdAction);
  });
});
