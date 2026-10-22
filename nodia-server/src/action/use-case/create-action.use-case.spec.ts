import { actorFixture } from '../../authorization/use-case/authority.fixture.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateActionUseCase } from './create-action.use-case.js';
import type { SaveActionUseCase } from './save-action.use-case.js';
import type { CreateActionDto } from '../dto/create-action.dto.js';

describe('CreateActionUseCase', () => {
  let useCase: CreateActionUseCase;
  let actionServiceMock: Partial<SaveActionUseCase>;

  beforeEach(() => {
    actionServiceMock = {
      execute: vi.fn(),
    };
    useCase = new CreateActionUseCase(actionServiceMock as SaveActionUseCase);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call actionService.execute with dto and return the created action', async () => {
    const dto: CreateActionDto = {
      key: 'roles.delete',
      description: 'Delete roles',
      is_active: true,
      translates: [
        { key: 'key', es: 'Eliminar roles', en: 'Delete roles' },
        {
          key: 'comment',
          es: 'Permite eliminar roles del sistema',
          en: 'Allows deleting system roles',
        },
      ],
    };

    const createdAction = {
      id: '1',
      key: 'roles.delete',
      description: 'Delete roles',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      action_roles: [],
      translates: [
        { key: 'key', es: 'Eliminar roles', en: 'Delete roles' },
        {
          key: 'comment',
          es: 'Permite eliminar roles del sistema',
          en: 'Allows deleting system roles',
        },
      ],
    };

    vi.mocked(actionServiceMock.execute!).mockResolvedValue(
      createdAction as any,
    );

    const result = await useCase.execute(dto, actorFixture('1'));

    expect(actionServiceMock.execute).toHaveBeenCalledTimes(1);
    expect(actionServiceMock.execute).toHaveBeenCalledWith(
      undefined,
      dto,
      actorFixture('1'),
    );
    expect(result).toEqual(createdAction);
  });
});
