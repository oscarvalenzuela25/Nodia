import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAllModulesUseCase } from './get-all-modules.use-case.js';
import type { ModuleService } from '../module.service.js';
import type { GetModulesDto } from '../dto/get-modules.dto.js';
import type { GetModulesResponse } from '../types/module.types.js';

describe('GetAllModulesUseCase', () => {
  let useCase: GetAllModulesUseCase;
  let moduleServiceMock: Partial<ModuleService>;

  beforeEach(() => {
    moduleServiceMock = {
      findAll: vi.fn(),
    };
    useCase = new GetAllModulesUseCase(moduleServiceMock as ModuleService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call moduleService.findAll with query params and return response', async () => {
    const dto: GetModulesDto = {
      page: 1,
      limit: 10,
      all: false,
    };

    const mockResponse: GetModulesResponse = {
      data: [
        {
          id: '1',
          key: 'general_settings',
          type: 'module',
          parent_id: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          actions: [],
          parent: null,
          children: [],
          parent_module: null,
        },
        {
          id: '2',
          key: 'users',
          type: 'submodule',
          parent_id: '1',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          actions: [],
          parent: null,
          children: [],
          parent_module: {
            id: '1',
            key: 'general_settings',
            type: 'module',
            is_active: true,
          },
        },
      ],
      meta: {
        page: 1,
        limit: 10,
        total_items: 2,
        total_pages: 1,
      },
    };

    vi.mocked(moduleServiceMock.findAll!).mockResolvedValue(mockResponse);

    const result = await useCase.execute(dto);

    expect(moduleServiceMock.findAll).toHaveBeenCalledTimes(1);
    expect(moduleServiceMock.findAll).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponse);
  });

  it('should call moduleService.findAll with includes=false', async () => {
    const dto: GetModulesDto = {
      page: 1,
      limit: 10,
      all: true,
      includes: false,
    };

    const mockResponse: GetModulesResponse = {
      data: [
        {
          id: '1',
          key: 'general_settings',
          type: 'module',
          parent_id: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          actions: [],
          parent: null,
          children: [],
          parent_module: null,
        },
      ],
      meta: {
        page: 1,
        limit: 1,
        total_items: 1,
        total_pages: 1,
      },
    };

    vi.mocked(moduleServiceMock.findAll!).mockResolvedValue(mockResponse);

    const result = await useCase.execute(dto);

    expect(moduleServiceMock.findAll).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponse);
  });
});
