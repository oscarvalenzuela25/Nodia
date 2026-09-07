import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateModuleUseCase } from './update-module.use-case.js';
import type { ModuleService } from '../module.service.js';
import type { UpdateModuleDto } from '../dto/update-module.dto.js';
import type { Module } from '../entities/module.entity.js';

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
      is_active: false,
    };

    const mockUpdatedModule: Partial<Module> = {
      id: '2',
      key: 'users_updated',
      type: 'submodule',
      parent_id: '1',
      is_active: false,
      created_at: new Date(),
      updated_at: new Date(),
      parent_module: {
        id: '1',
        key: 'general_settings',
        type: 'module',
        is_active: true,
      },
    };

    vi.mocked(moduleServiceMock.update!).mockResolvedValue(mockUpdatedModule as Module);

    const result = await useCase.execute(id, dto);

    expect(moduleServiceMock.update).toHaveBeenCalledTimes(1);
    expect(moduleServiceMock.update).toHaveBeenCalledWith(id, dto);
    expect(result).toEqual(mockUpdatedModule);
  });

  it('should propagate BadRequestException if attempting to remove parent_id from submodule', async () => {
    const id = '2';
    const dto: UpdateModuleDto = {
      parent_id: null,
    };

    vi.mocked(moduleServiceMock.update!).mockRejectedValue(
      new Error('parent_id is required when type is submodule'),
    );

    await expect(useCase.execute(id, dto)).rejects.toThrow(
      'parent_id is required when type is submodule',
    );
  });

  it('should propagate BadRequestException if parent is another submodule', async () => {
    const id = '2';
    const dto: UpdateModuleDto = {
      parent_id: 'submodule_id',
    };

    vi.mocked(moduleServiceMock.update!).mockRejectedValue(
      new Error('A submodule cannot have another submodule as its parent'),
    );

    await expect(useCase.execute(id, dto)).rejects.toThrow(
      'A submodule cannot have another submodule as its parent',
    );
  });

  it('should propagate BadRequestException if converting a module into a submodule while it still has linked submodules', async () => {
    const id = '1';
    const dto: UpdateModuleDto = {
      type: 'submodule',
      parent_id: '10',
    };

    vi.mocked(moduleServiceMock.update!).mockRejectedValue(
      new Error('Cannot convert a module with submodules into a submodule'),
    );

    await expect(useCase.execute(id, dto)).rejects.toThrow(
      'Cannot convert a module with submodules into a submodule',
    );
  });
});
