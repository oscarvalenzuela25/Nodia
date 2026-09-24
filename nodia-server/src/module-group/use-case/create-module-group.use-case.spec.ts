import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateModuleGroupUseCase } from './create-module-group.use-case.js';
import type { ModuleGroupService } from '../module-group.service.js';
import type { CreateModuleGroupDto } from '../dto/create-module-group.dto.js';

describe('CreateModuleGroupUseCase', () => {
  let useCase: CreateModuleGroupUseCase;
  let moduleGroupServiceMock: Partial<ModuleGroupService>;

  beforeEach(() => {
    moduleGroupServiceMock = {
      create: vi.fn(),
    };
    useCase = new CreateModuleGroupUseCase(moduleGroupServiceMock as ModuleGroupService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call moduleGroupService.create with CreateModuleGroupDto and return created group', async () => {
    const dto: CreateModuleGroupDto = {
      key: 'settings',
      icon: 'SettingsOutlined',
      is_active: true,
      translates: [
        { key: 'key', es: 'Ajustes', en: 'Settings' },
      ],
    };

    const mockCreatedGroup = {
      id: '1',
      key: 'settings',
      icon: 'SettingsOutlined',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      translates: [
        { key: 'key', es: 'Ajustes', en: 'Settings' },
      ],
    };

    vi.mocked(moduleGroupServiceMock.create!).mockResolvedValue(mockCreatedGroup as any);

    const result = await useCase.execute(dto);

    expect(moduleGroupServiceMock.create).toHaveBeenCalledTimes(1);
    expect(moduleGroupServiceMock.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockCreatedGroup);
  });
});
