import { actorFixture } from '../../authorization/use-case/authority.fixture.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateRoleUseCase } from './update-role.use-case.js';
import type { SaveRoleUseCase } from './save-role.use-case.js';
import type { UpdateRoleDto } from '../dto/update-role.dto.js';

describe('UpdateRoleUseCase', () => {
  let useCase: UpdateRoleUseCase;
  let roleServiceMock: Partial<SaveRoleUseCase>;

  beforeEach(() => {
    roleServiceMock = {
      execute: vi.fn(),
    };
    useCase = new UpdateRoleUseCase(roleServiceMock as SaveRoleUseCase);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call roleService.execute with id and dto and return updated role', async () => {
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

    vi.mocked(roleServiceMock.execute!).mockResolvedValue(updatedRole as any);

    const result = await useCase.execute(id, dto, actorFixture('1'));

    expect(roleServiceMock.execute).toHaveBeenCalledTimes(1);
    expect(roleServiceMock.execute).toHaveBeenCalledWith(
      id,
      dto,
      actorFixture('1'),
    );
    expect(result).toEqual(updatedRole);
  });

  it('should call roleService.execute with actions array and return role with synced actions', async () => {
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

    vi.mocked(roleServiceMock.execute!).mockResolvedValue(updatedRole as any);

    const result = await useCase.execute(id, dto, actorFixture('1'));

    expect(roleServiceMock.execute).toHaveBeenCalledTimes(1);
    expect(roleServiceMock.execute).toHaveBeenCalledWith(
      id,
      dto,
      actorFixture('1'),
    );
    expect(result).toEqual(updatedRole);
  });

  it('should call roleService.execute with translates and return role with updated translates', async () => {
    const id = '1';
    const dto: UpdateRoleDto = {
      translates: [
        { key: 'key', es: 'Super Administrador', en: 'Super Administrator' },
      ],
    };

    const updatedRole = {
      id,
      key: 'super_admin',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      actions: [],
      translates: [
        { key: 'key', es: 'Super Administrador', en: 'Super Administrator' },
      ],
    };

    vi.mocked(roleServiceMock.execute!).mockResolvedValue(updatedRole as any);

    const result = await useCase.execute(id, dto, actorFixture('1'));

    expect(roleServiceMock.execute).toHaveBeenCalledTimes(1);
    expect(roleServiceMock.execute).toHaveBeenCalledWith(
      id,
      dto,
      actorFixture('1'),
    );
    expect(result).toEqual(updatedRole);
  });
});
