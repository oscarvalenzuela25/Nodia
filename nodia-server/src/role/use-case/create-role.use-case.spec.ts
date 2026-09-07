import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateRoleUseCase } from './create-role.use-case.js';
import type { RoleService } from '../role.service.js';
import type { CreateRoleDto } from '../dto/create-role.dto.js';

describe('CreateRoleUseCase', () => {
  let useCase: CreateRoleUseCase;
  let roleServiceMock: Partial<RoleService>;

  beforeEach(() => {
    roleServiceMock = {
      create: vi.fn(),
    };
    useCase = new CreateRoleUseCase(roleServiceMock as RoleService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call roleService.create with the provided dto and return the created role', async () => {
    const dto: CreateRoleDto = {
      key: 'manager',
      is_active: true,
    };

    const createdRole = {
      id: '1',
      key: 'manager',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      actions: [],
    };

    vi.mocked(roleServiceMock.create!).mockResolvedValue(createdRole as any);

    const result = await useCase.execute(dto);

    expect(roleServiceMock.create).toHaveBeenCalledTimes(1);
    expect(roleServiceMock.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(createdRole);
  });

  it('should call roleService.create with actions array and return role with actions', async () => {
    const dto: CreateRoleDto = {
      key: 'admin',
      is_active: true,
      actions: ['10', '20'],
    };

    const createdRole = {
      id: '2',
      key: 'admin',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      actions: [
        { id: '10', key: 'users.create', is_active: true },
        { id: '20', key: 'users.read', is_active: true },
      ],
    };

    vi.mocked(roleServiceMock.create!).mockResolvedValue(createdRole as any);

    const result = await useCase.execute(dto);

    expect(roleServiceMock.create).toHaveBeenCalledTimes(1);
    expect(roleServiceMock.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(createdRole);
  });
});
