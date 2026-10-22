import { actorFixture } from '../../authorization/use-case/authority.fixture.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateActionUseCase } from './update-action.use-case.js';
import type { SaveActionUseCase } from './save-action.use-case.js';
import type { UpdateActionDto } from '../dto/update-action.dto.js';

describe('UpdateActionUseCase', () => {
  let useCase: UpdateActionUseCase;
  let actionServiceMock: Partial<SaveActionUseCase>;

  beforeEach(() => {
    actionServiceMock = {
      execute: vi.fn(),
    };
    useCase = new UpdateActionUseCase(actionServiceMock as SaveActionUseCase);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call actionService.execute with id and dto and return updated action', async () => {
    const id = '1';
    const dto: UpdateActionDto = {
      description: 'Updated description',
      is_active: false,
      translates: [
        {
          key: 'comment',
          es: 'Descripción actualizada',
          en: 'Updated description',
        },
      ],
    };

    const updatedAction = {
      id,
      key: 'roles.delete',
      description: 'Updated description',
      is_active: false,
      created_at: new Date(),
      updated_at: new Date(),
      action_roles: [],
      translates: [
        { key: 'key', es: 'Eliminar roles', en: 'Delete roles' },
        {
          key: 'comment',
          es: 'Descripción actualizada',
          en: 'Updated description',
        },
      ],
    };

    vi.mocked(actionServiceMock.execute!).mockResolvedValue(
      updatedAction as any,
    );

    const result = await useCase.execute(id, dto, actorFixture('1'));

    expect(actionServiceMock.execute).toHaveBeenCalledTimes(1);
    expect(actionServiceMock.execute).toHaveBeenCalledWith(
      id,
      dto,
      actorFixture('1'),
    );
    expect(result).toEqual(updatedAction);
  });
});
