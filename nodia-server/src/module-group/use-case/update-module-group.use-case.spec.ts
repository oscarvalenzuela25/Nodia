import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateModuleGroupUseCase } from './update-module-group.use-case.js';
import type { ModuleGroupService } from '../module-group.service.js';
import type { UpdateModuleGroupDto } from '../dto/update-module-group.dto.js';

describe('UpdateModuleGroupUseCase', () => {
  let useCase: UpdateModuleGroupUseCase;
  let moduleGroupServiceMock: Partial<ModuleGroupService>;

  beforeEach(() => {
    moduleGroupServiceMock = {
      update: vi.fn(),
    };
    useCase = new UpdateModuleGroupUseCase(moduleGroupServiceMock as ModuleGroupService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call moduleGroupService.update with id and UpdateModuleGroupDto and return updated group', async () => {
    const id = '1';
    const dto: UpdateModuleGroupDto = {
      key: 'settings_updated',
      translates: [
        { key: 'key', es: 'Ajustes Modificado', en: 'Updated Settings' },
      ],
    };

    const mockUpdatedGroup = {
      id: '1',
      key: 'settings_updated',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      translates: [
        { key: 'key', es: 'Ajustes Modificado', en: 'Updated Settings' },
      ],
    };

    vi.mocked(moduleGroupServiceMock.update!).mockResolvedValue(mockUpdatedGroup as any);

    const result = await useCase.execute(id, dto);

    expect(moduleGroupServiceMock.update).toHaveBeenCalledTimes(1);
    expect(moduleGroupServiceMock.update).toHaveBeenCalledWith(id, dto);
    expect(result).toEqual(mockUpdatedGroup);
  });
});
