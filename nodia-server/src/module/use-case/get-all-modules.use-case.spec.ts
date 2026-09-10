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
          module_group_id: '1',
          link: '/general-settings',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          module_users: [],
          translates: [
            { key: 'key', es: 'Ajustes Generales', en: 'General Settings' },
          ],
        } as any,
        {
          id: '2',
          key: 'users',
          module_group_id: '1',
          link: '/general-settings/users',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          module_users: [],
          translates: [
            { key: 'key', es: 'Usuarios', en: 'Users' },
          ],
        } as any,
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
          module_group_id: '1',
          link: '/general-settings',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          module_users: [],
          translates: [
            { key: 'key', es: 'Ajustes Generales', en: 'General Settings' },
          ],
        } as any,
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
