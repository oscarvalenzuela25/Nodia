import { actorFixture } from '../../authorization/use-case/authority.fixture.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateModuleUseCase } from './update-module.use-case.js';
import type { SaveModuleUseCase } from './save-module.use-case.js';
import type { UpdateModuleDto } from '../dto/update-module.dto.js';

describe('UpdateModuleUseCase', () => {
  let useCase: UpdateModuleUseCase;
  let moduleServiceMock: Partial<SaveModuleUseCase>;

  beforeEach(() => {
    moduleServiceMock = {
      execute: vi.fn(),
    };
    useCase = new UpdateModuleUseCase(moduleServiceMock as SaveModuleUseCase);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call moduleService.execute with id and UpdateModuleDto and return updated module', async () => {
    const id = '2';
    const dto: UpdateModuleDto = {
      key: 'users_updated',
      module_group_id: '1',
      link: '/general-settings/users-updated',
      is_active: false,
      translates: [
        { key: 'key', es: 'Usuarios Actualizado', en: 'Users Updated' },
      ],
    };

    const mockUpdatedModule = {
      id: '2',
      key: 'users_updated',
      module_group_id: '1',
      link: '/general-settings/users-updated',
      is_active: false,
      created_at: new Date(),
      updated_at: new Date(),
      translates: [
        { key: 'key', es: 'Usuarios Actualizado', en: 'Users Updated' },
      ],
    };

    vi.mocked(moduleServiceMock.execute!).mockResolvedValue(
      mockUpdatedModule as any,
    );

    const result = await useCase.execute(id, dto, actorFixture('1'));

    expect(moduleServiceMock.execute).toHaveBeenCalledTimes(1);
    expect(moduleServiceMock.execute).toHaveBeenCalledWith(
      id,
      dto,
      actorFixture('1'),
    );
    expect(result).toEqual(mockUpdatedModule);
  });
});
