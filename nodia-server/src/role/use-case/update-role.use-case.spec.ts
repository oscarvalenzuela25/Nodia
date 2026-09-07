import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateRoleUseCase } from './update-role.use-case.js';
import type { RoleService } from '../role.service.js';
import type { UpdateRoleDto } from '../dto/update-role.dto.js';

describe('UpdateRoleUseCase', () => {
  let useCase: UpdateRoleUseCase;
  let roleServiceMock: Partial<RoleService>;

  beforeEach(() => {
    roleServiceMock = {
      update: vi.fn(),
    };
    useCase = new UpdateRoleUseCase(roleServiceMock as RoleService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call roleService.update with id and dto and return updated role', async () => {
    const id = '1';
    const dto: UpdateRoleDto = {
      key: 'manager_updated',
      is_active: false,
    };

    const updatedRole = {
      id,
      key: 'manager_updated',
      is_active: false,
      created_at: new Date(),
      updated_at: new Date(),
      actions: [],
    };

    vi.mocked(roleServiceMock.update!).mockResolvedValue(updatedRole as any);

    const result = await useCase.execute(id, dto);

    expect(roleServiceMock.update).toHaveBeenCalledTimes(1);
    expect(roleServiceMock.update).toHaveBeenCalledWith(id, dto);
    expect(result).toEqual(updatedRole);
  });

  it('should call roleService.update with actions array and return role with synced actions', async () => {
    const id = '1';
    const dto: UpdateRoleDto = {
      actions: ['10', '30'],
    };

    const updatedRole = {
      id,
      key: 'admin',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      actions: [
        { id: '10', key: 'users.create', is_active: true },
        { id: '30', key: 'roles.manage', is_active: true },
      ],
    };

    vi.mocked(roleServiceMock.update!).mockResolvedValue(updatedRole as any);

    const result = await useCase.execute(id, dto);

    expect(roleServiceMock.update).toHaveBeenCalledTimes(1);
    expect(roleServiceMock.update).toHaveBeenCalledWith(id, dto);
    expect(result).toEqual(updatedRole);
  });
});
