import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateUserUseCase } from './create-user.use-case.js';
import type { UserService } from '../user.service.js';
import type { CreateUserDto } from '../dto/create-user.dto.js';

describe('CreateUserUseCase', () => {
  let useCase: CreateUserUseCase;
  let userServiceMock: Partial<UserService>;

  beforeEach(() => {
    userServiceMock = {
      create: vi.fn(),
    };
    useCase = new CreateUserUseCase(userServiceMock as UserService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call userService.create with the provided dto and return the created user', async () => {
    const dto: CreateUserDto = {
      name: 'John Doe',
      email: 'john@example.com',
      is_active: true,
    };

    const createdUser = {
      id: '1',
      ...dto,
      image_url: null,
      created_at: new Date(),
      updated_at: new Date(),
      user_roles: [],
    };

    vi.mocked(userServiceMock.create!).mockResolvedValue(createdUser as any);

    const result = await useCase.execute(dto);

    expect(userServiceMock.create).toHaveBeenCalledTimes(1);
    expect(userServiceMock.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(createdUser);
  });

  it('should call userService.create with role IDs and return the user with assigned roles', async () => {
    const dto: CreateUserDto = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      is_active: true,
      roles: ['10', '20'],
    };

    const createdUser = {
      id: '2',
      name: 'Jane Doe',
      email: 'jane@example.com',
      is_active: true,
      image_url: null,
      created_at: new Date(),
      updated_at: new Date(),
      roles: [
        { id: '10', key: 'admin', is_active: true },
        { id: '20', key: 'manager', is_active: true },
      ],
    };

    vi.mocked(userServiceMock.create!).mockResolvedValue(createdUser as any);

    const result = await useCase.execute(dto);

    expect(userServiceMock.create).toHaveBeenCalledTimes(1);
    expect(userServiceMock.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(createdUser);
  });

  it('should call userService.create with module IDs and return the user with assigned modules', async () => {
    const dto: CreateUserDto = {
      name: 'Alice Doe',
      email: 'alice@example.com',
      is_active: true,
      modules: ['5', '6'],
    };

    const createdUser = {
      id: '3',
      name: 'Alice Doe',
      email: 'alice@example.com',
      is_active: true,
      image_url: null,
      created_at: new Date(),
      updated_at: new Date(),
      modules: [
        { id: '5', key: 'users', group_by: 'settings', is_active: true },
        { id: '6', key: 'roles', group_by: 'settings', is_active: true },
      ],
    };

    vi.mocked(userServiceMock.create!).mockResolvedValue(createdUser as any);

    const result = await useCase.execute(dto);

    expect(userServiceMock.create).toHaveBeenCalledTimes(1);
    expect(userServiceMock.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(createdUser);
  });
});

