import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateModuleUseCase } from './create-module.use-case.js';
import type { ModuleService } from '../module.service.js';
import type { CreateModuleDto } from '../dto/create-module.dto.js';
import type { Module } from '../entities/module.entity.js';

describe('CreateModuleUseCase', () => {
  let useCase: CreateModuleUseCase;
  let moduleServiceMock: Partial<ModuleService>;

  beforeEach(() => {
    moduleServiceMock = {
      create: vi.fn(),
    };
    useCase = new CreateModuleUseCase(moduleServiceMock as ModuleService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call moduleService.create with CreateModuleDto and return created module', async () => {
    const dto: CreateModuleDto = {
      key: 'users',
      type: 'submodule',
      parent_id: '1',
      is_active: true,
    };

    const mockCreatedModule: Partial<Module> = {
      id: '2',
      key: 'users',
      type: 'submodule',
      parent_id: '1',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      parent_module: {
        id: '1',
        key: 'general_settings',
        type: 'module',
        is_active: true,
      },
    };

    vi.mocked(moduleServiceMock.create!).mockResolvedValue(mockCreatedModule as Module);

    const result = await useCase.execute(dto);

    expect(moduleServiceMock.create).toHaveBeenCalledTimes(1);
    expect(moduleServiceMock.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockCreatedModule);
  });

  it('should propagate BadRequestException if submodule has no parent_id or parent is invalid', async () => {
    const dto: CreateModuleDto = {
      key: 'users',
      type: 'submodule',
      parent_id: null,
      is_active: true,
    };

    vi.mocked(moduleServiceMock.create!).mockRejectedValue(
      new Error('parent_id is required when type is submodule'),
    );

    await expect(useCase.execute(dto)).rejects.toThrow(
      'parent_id is required when type is submodule',
    );
  });

  it('should propagate BadRequestException if parent is another submodule', async () => {
    const dto: CreateModuleDto = {
      key: 'roles',
      type: 'submodule',
      parent_id: 'submodule_id',
      is_active: true,
    };

    vi.mocked(moduleServiceMock.create!).mockRejectedValue(
      new Error('A submodule cannot have another submodule as its parent'),
    );

    await expect(useCase.execute(dto)).rejects.toThrow(
      'A submodule cannot have another submodule as its parent',
    );
  });
});
