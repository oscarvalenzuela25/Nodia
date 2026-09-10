import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAllModuleGroupsUseCase } from './get-all-module-groups.use-case.js';
import type { ModuleGroupService } from '../module-group.service.js';
import type { GetModuleGroupsDto } from '../dto/get-module-groups.dto.js';
import type { GetModuleGroupsResponse } from '../types/module-group.types.js';

describe('GetAllModuleGroupsUseCase', () => {
  let useCase: GetAllModuleGroupsUseCase;
  let moduleGroupServiceMock: Partial<ModuleGroupService>;

  beforeEach(() => {
    moduleGroupServiceMock = {
      findAll: vi.fn(),
    };
    useCase = new GetAllModuleGroupsUseCase(moduleGroupServiceMock as ModuleGroupService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call moduleGroupService.findAll with the provided dto and return the response', async () => {
    const dto: GetModuleGroupsDto = {
      page: 1,
      limit: 10,
      all: false,
      includes: true,
      q: {
        key_cont: 'settings',
        is_active_eq: true,
      },
    };

    const mockResponse: GetModuleGroupsResponse = {
      data: [
        {
          id: '1',
          key: 'settings',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          translates: [
            { key: 'key', es: 'Ajustes', en: 'Settings' },
          ],
        },
      ],
      meta: {
        page: 1,
        limit: 10,
        total_items: 1,
        total_pages: 1,
      },
    };

    vi.mocked(moduleGroupServiceMock.findAll!).mockResolvedValue(mockResponse);

    const result = await useCase.execute(dto);

    expect(moduleGroupServiceMock.findAll).toHaveBeenCalledTimes(1);
    expect(moduleGroupServiceMock.findAll).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponse);
  });
});
