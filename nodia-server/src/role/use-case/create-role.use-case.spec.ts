import { actorFixture } from '../../authorization/use-case/authority.fixture.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateRoleUseCase } from './create-role.use-case.js';
import type { SaveRoleUseCase } from './save-role.use-case.js';
import type { CreateRoleDto } from '../dto/create-role.dto.js';

describe('CreateRoleUseCase', () => {
  let useCase: CreateRoleUseCase;
  let roleServiceMock: Partial<SaveRoleUseCase>;

  beforeEach(() => {
    roleServiceMock = {
      execute: vi.fn(),
    };
    useCase = new CreateRoleUseCase(roleServiceMock as SaveRoleUseCase);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call roleService.execute with the provided dto and return the created role', async () => {
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

    vi.mocked(roleServiceMock.execute!).mockResolvedValue(createdRole as any);

    const result = await useCase.execute(dto, actorFixture('1'));

    expect(roleServiceMock.execute).toHaveBeenCalledTimes(1);
    expect(roleServiceMock.execute).toHaveBeenCalledWith(
      undefined,
      dto,
      actorFixture('1'),
    );
    expect(result).toEqual(createdRole);
  });

  it('should call roleService.execute with actions array and return role with actions', async () => {
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
        { id: '10', key: 'users.execute', is_active: true },
        { id: '20', key: 'users.read', is_active: true },
      ],
    };

    vi.mocked(roleServiceMock.execute!).mockResolvedValue(createdRole as any);

    const result = await useCase.execute(dto, actorFixture('1'));

    expect(roleServiceMock.execute).toHaveBeenCalledTimes(1);
    expect(roleServiceMock.execute).toHaveBeenCalledWith(
      undefined,
      dto,
      actorFixture('1'),
    );
    expect(result).toEqual(createdRole);
  });

  it('should call roleService.execute with translates and return role with translates', async () => {
    const dto: CreateRoleDto = {
      key: 'supervisor',
      is_active: true,
      translates: [{ key: 'key', es: 'Supervisor', en: 'Supervisor' }],
    };

    const createdRole = {
      id: '3',
      key: 'supervisor',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      actions: [],
      translates: [{ key: 'key', es: 'Supervisor', en: 'Supervisor' }],
    };

    vi.mocked(roleServiceMock.execute!).mockResolvedValue(createdRole as any);

    const result = await useCase.execute(dto, actorFixture('1'));

    expect(roleServiceMock.execute).toHaveBeenCalledTimes(1);
    expect(roleServiceMock.execute).toHaveBeenCalledWith(
      undefined,
      dto,
      actorFixture('1'),
    );
    expect(result).toEqual(createdRole);
  });
});
