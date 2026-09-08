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
      group_by: 'settings',
      is_active: true,
      translates: [
        { key: 'key', es: 'Usuarios', en: 'Users' },
      ],
    };

    const mockCreatedModule = {
      id: '2',
      key: 'users',
      group_by: 'settings',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      translates: [
        { key: 'key', es: 'Usuarios', en: 'Users' },
      ],
    };

    vi.mocked(moduleServiceMock.create!).mockResolvedValue(mockCreatedModule as any);

    const result = await useCase.execute(dto);

    expect(moduleServiceMock.create).toHaveBeenCalledTimes(1);
    expect(moduleServiceMock.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockCreatedModule);
  });
});

