import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAllRolesUseCase } from './get-all-roles.use-case.js';
import type { RoleService } from '../role.service.js';
import type { GetRolesDto } from '../dto/get-roles.dto.js';
import type { GetRolesResponse } from '../types/role.types.js';

describe('GetAllRolesUseCase', () => {
  let useCase: GetAllRolesUseCase;
  let roleServiceMock: Partial<RoleService>;

  beforeEach(() => {
    roleServiceMock = {
      findAll: vi.fn(),
    };
    useCase = new GetAllRolesUseCase(roleServiceMock as RoleService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call roleService.findAll with the provided query params and return the response', async () => {
    const dto: GetRolesDto = {
      page: 1,
      limit: 10,
      all: false,
    };

    const mockResponse: GetRolesResponse = {
      data: [
        {
          id: '1',
          key: 'admin',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          role_users: [],
          role_actions: [],
          translates: [
            { key: 'key', es: 'Administrador', en: 'Administrator' },
          ],
        } as any,
      ],
      meta: {
        page: 1,
        limit: 10,
        total_items: 1,
        total_pages: 1,
      },
    };

    vi.mocked(roleServiceMock.findAll!).mockResolvedValue(mockResponse);

    const result = await useCase.execute(dto);

    expect(roleServiceMock.findAll).toHaveBeenCalledTimes(1);
    expect(roleServiceMock.findAll).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponse);
  });

  it('should call roleService.findAll with includes=false to omit relations', async () => {
    const dto: GetRolesDto = {
      page: 1,
      limit: 10,
      all: true,
      includes: false,
    };

    const mockResponse: GetRolesResponse = {
      data: [
        {
          id: '1',
          key: 'admin',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          role_users: [],
          role_actions: [],
          actions: [],
          translates: [
            { key: 'key', es: 'Administrador', en: 'Administrator' },
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

    vi.mocked(roleServiceMock.findAll!).mockResolvedValue(mockResponse);

    const result = await useCase.execute(dto);

    expect(roleServiceMock.findAll).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponse);
  });
});
