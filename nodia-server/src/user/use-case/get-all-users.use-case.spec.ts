import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAllUsersUseCase } from './get-all-users.use-case.js';
import type { UserService } from '../user.service.js';
import type { GetUsersDto } from '../dto/get-users.dto.js';
import type { GetUsersResponse } from '../types/user.types.js';

describe('GetAllUsersUseCase', () => {
  let useCase: GetAllUsersUseCase;
  let userServiceMock: Partial<UserService>;

  beforeEach(() => {
    userServiceMock = {
      findAll: vi.fn(),
    };
    useCase = new GetAllUsersUseCase(userServiceMock as UserService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call userService.findAll with the provided query params and return the response', async () => {
    const dto: GetUsersDto = {
      page: 1,
      limit: 10,
      all: false,
    };

    const mockResponse: GetUsersResponse = {
      data: [
        {
          id: '1',
          name: 'Jane Doe',
          email: 'jane@example.com',
          image_url: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          user_roles: [],
        },
      ],
      meta: {
        page: 1,
        limit: 10,
        total_items: 1,
        total_pages: 1,
      },
    };

    vi.mocked(userServiceMock.findAll!).mockResolvedValue(mockResponse);

    const result = await useCase.execute(dto);

    expect(userServiceMock.findAll).toHaveBeenCalledTimes(1);
    expect(userServiceMock.findAll).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponse);
  });

  it('should call userService.findAll with includes=false to omit relations', async () => {
    const dto: GetUsersDto = {
      page: 1,
      limit: 10,
      all: true,
      includes: false,
    };

    const mockResponse: GetUsersResponse = {
      data: [
        {
          id: '1',
          name: 'Jane Doe',
          email: 'jane@example.com',
          image_url: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          user_roles: [],
          roles: [],
        },
      ],
      meta: {
        page: 1,
        limit: 1,
        total_items: 1,
        total_pages: 1,
      },
    };

    vi.mocked(userServiceMock.findAll!).mockResolvedValue(mockResponse);

    const result = await useCase.execute(dto);

    expect(userServiceMock.findAll).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponse);
  });

  it('should return users with modules containing translates when included', async () => {
    const dto: GetUsersDto = {
      page: 1,
      limit: 10,
      all: false,
      includes: true,
    };

    const mockResponse: GetUsersResponse = {
      data: [
        {
          id: '1',
          name: 'Jane Doe',
          email: 'jane@example.com',
          image_url: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          user_roles: [],
          roles: [],
          modules: [
            {
              id: '10',
              key: 'settings',
              group_by: 'core',
              is_active: true,
              created_at: new Date(),
              updated_at: new Date(),
              module_users: [],
              translates: [
                { key: 'key', es: 'Configuración', en: 'Settings' },
              ],
            } as any,
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

    vi.mocked(userServiceMock.findAll!).mockResolvedValue(mockResponse);

    const result = await useCase.execute(dto);

    expect(userServiceMock.findAll).toHaveBeenCalledWith(dto);
    expect(result.data[0].modules?.[0].translates).toEqual([
      { key: 'key', es: 'Configuración', en: 'Settings' },
    ]);
  });
});
