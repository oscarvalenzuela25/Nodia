import { actorFixture } from '../../authorization/use-case/authority.fixture.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateUserUseCase } from './update-user.use-case.js';
import type { SaveUserUseCase } from './save-user.use-case.js';
import type { UpdateUserDto } from '../dto/update-user.dto.js';

describe('UpdateUserUseCase', () => {
  let useCase: UpdateUserUseCase;
  let userServiceMock: Partial<SaveUserUseCase>;

  beforeEach(() => {
    userServiceMock = {
      execute: vi.fn(),
    };
    useCase = new UpdateUserUseCase(userServiceMock as SaveUserUseCase);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call userService.execute with the provided id and dto and return the updated user', async () => {
    const id = '1';
    const dto: UpdateUserDto = {
      name: 'John Updated',
      is_active: false,
    };

    const updatedUser = {
      id,
      name: 'John Updated',
      email: 'john@example.com',
      image_url: null,
      is_active: false,
      created_at: new Date(),
      updated_at: new Date(),
      user_roles: [],
    };

    vi.mocked(userServiceMock.execute!).mockResolvedValue(updatedUser as any);

    const result = await useCase.execute(id, dto, actorFixture('1'));

    expect(userServiceMock.execute).toHaveBeenCalledTimes(1);
    expect(userServiceMock.execute).toHaveBeenCalledWith(
      id,
      dto,
      actorFixture('1'),
    );
    expect(result).toEqual(updatedUser);
  });

  it('should call userService.execute with role IDs and return the updated user with new roles', async () => {
    const id = '1';
    const dto: UpdateUserDto = {
      roles: ['10', '30'],
    };

    const updatedUser = {
      id,
      name: 'John Doe',
      email: 'john@example.com',
      image_url: null,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      roles: [
        { id: '10', key: 'admin', is_active: true },
        { id: '30', key: 'supervisor', is_active: true },
      ],
    };

    vi.mocked(userServiceMock.execute!).mockResolvedValue(updatedUser as any);

    const result = await useCase.execute(id, dto, actorFixture('1'));

    expect(userServiceMock.execute).toHaveBeenCalledTimes(1);
    expect(userServiceMock.execute).toHaveBeenCalledWith(
      id,
      dto,
      actorFixture('1'),
    );
    expect(result).toEqual(updatedUser);
  });

  it('should call userService.execute with module IDs and return the updated user with new modules', async () => {
    const id = '1';
    const dto: UpdateUserDto = {
      modules: ['5', '8'],
    };

    const updatedUser = {
      id,
      name: 'John Doe',
      email: 'john@example.com',
      image_url: null,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      modules: [
        { id: '5', key: 'users', group_by: 'settings', is_active: true },
        { id: '8', key: 'billing', group_by: 'finance', is_active: true },
      ],
    };

    vi.mocked(userServiceMock.execute!).mockResolvedValue(updatedUser as any);

    const result = await useCase.execute(id, dto, actorFixture('1'));

    expect(userServiceMock.execute).toHaveBeenCalledTimes(1);
    expect(userServiceMock.execute).toHaveBeenCalledWith(
      id,
      dto,
      actorFixture('1'),
    );
    expect(result).toEqual(updatedUser);
  });
});
