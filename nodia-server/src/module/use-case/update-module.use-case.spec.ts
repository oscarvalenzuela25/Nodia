import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateModuleUseCase } from './update-module.use-case.js';
import type { ModuleService } from '../module.service.js';
import type { UpdateModuleDto } from '../dto/update-module.dto.js';

describe('UpdateModuleUseCase', () => {
  let useCase: UpdateModuleUseCase;
  let moduleServiceMock: Partial<ModuleService>;

  beforeEach(() => {
    moduleServiceMock = {
      update: vi.fn(),
    };
    useCase = new UpdateModuleUseCase(moduleServiceMock as ModuleService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call moduleService.update with id and UpdateModuleDto and return updated module', async () => {
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

    vi.mocked(moduleServiceMock.update!).mockResolvedValue(mockUpdatedModule as any);

    const result = await useCase.execute(id, dto);

    expect(moduleServiceMock.update).toHaveBeenCalledTimes(1);
    expect(moduleServiceMock.update).toHaveBeenCalledWith(id, dto);
    expect(result).toEqual(mockUpdatedModule);
  });
});

