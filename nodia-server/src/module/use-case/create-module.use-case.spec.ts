import { actorFixture } from '../../authorization/use-case/authority.fixture.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateModuleUseCase } from './create-module.use-case.js';
import type { SaveModuleUseCase } from './save-module.use-case.js';
import type { CreateModuleDto } from '../dto/create-module.dto.js';

describe('CreateModuleUseCase', () => {
  let useCase: CreateModuleUseCase;
  let moduleServiceMock: Partial<SaveModuleUseCase>;

  beforeEach(() => {
    moduleServiceMock = {
      execute: vi.fn(),
    };
    useCase = new CreateModuleUseCase(moduleServiceMock as SaveModuleUseCase);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call moduleService.execute with CreateModuleDto and return created module', async () => {
    const dto: CreateModuleDto = {
      key: 'users',
      module_group_id: '1',
      link: '/users',
      icon: 'PersonOutlined',
      is_active: true,
      translates: [{ key: 'key', es: 'Usuarios', en: 'Users' }],
    };

    const mockCreatedModule = {
      id: '2',
      key: 'users',
      module_group_id: '1',
      link: '/users',
      icon: 'PersonOutlined',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      translates: [{ key: 'key', es: 'Usuarios', en: 'Users' }],
    };

    vi.mocked(moduleServiceMock.execute!).mockResolvedValue(
      mockCreatedModule as any,
    );

    const result = await useCase.execute(dto, actorFixture('1'));

    expect(moduleServiceMock.execute).toHaveBeenCalledTimes(1);
    expect(moduleServiceMock.execute).toHaveBeenCalledWith(
      undefined,
      dto,
      actorFixture('1'),
    );
    expect(result).toEqual(mockCreatedModule);
  });
});
