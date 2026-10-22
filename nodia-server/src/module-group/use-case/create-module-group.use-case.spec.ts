import { actorFixture } from '../../authorization/use-case/authority.fixture.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateModuleGroupUseCase } from './create-module-group.use-case.js';
import type { SaveModuleGroupUseCase } from './save-module-group.use-case.js';
import type { CreateModuleGroupDto } from '../dto/create-module-group.dto.js';

describe('CreateModuleGroupUseCase', () => {
  let useCase: CreateModuleGroupUseCase;
  let moduleGroupServiceMock: Partial<SaveModuleGroupUseCase>;

  beforeEach(() => {
    moduleGroupServiceMock = {
      execute: vi.fn(),
    };
    useCase = new CreateModuleGroupUseCase(
      moduleGroupServiceMock as SaveModuleGroupUseCase,
    );
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call moduleGroupService.execute with CreateModuleGroupDto and return created group', async () => {
    const dto: CreateModuleGroupDto = {
      key: 'settings',
      icon: 'SettingsOutlined',
      is_active: true,
      translates: [{ key: 'key', es: 'Ajustes', en: 'Settings' }],
    };

    const mockCreatedGroup = {
      id: '1',
      key: 'settings',
      icon: 'SettingsOutlined',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      translates: [{ key: 'key', es: 'Ajustes', en: 'Settings' }],
    };

    vi.mocked(moduleGroupServiceMock.execute!).mockResolvedValue(
      mockCreatedGroup as any,
    );

    const result = await useCase.execute(dto, actorFixture('1'));

    expect(moduleGroupServiceMock.execute).toHaveBeenCalledTimes(1);
    expect(moduleGroupServiceMock.execute).toHaveBeenCalledWith(
      undefined,
      dto,
      actorFixture('1'),
    );
    expect(result).toEqual(mockCreatedGroup);
  });
});
