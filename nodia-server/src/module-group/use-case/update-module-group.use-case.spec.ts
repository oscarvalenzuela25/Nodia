import { actorFixture } from '../../authorization/use-case/authority.fixture.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateModuleGroupUseCase } from './update-module-group.use-case.js';
import type { SaveModuleGroupUseCase } from './save-module-group.use-case.js';
import type { UpdateModuleGroupDto } from '../dto/update-module-group.dto.js';

describe('UpdateModuleGroupUseCase', () => {
  let useCase: UpdateModuleGroupUseCase;
  let moduleGroupServiceMock: Partial<SaveModuleGroupUseCase>;

  beforeEach(() => {
    moduleGroupServiceMock = {
      execute: vi.fn(),
    };
    useCase = new UpdateModuleGroupUseCase(
      moduleGroupServiceMock as SaveModuleGroupUseCase,
    );
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call moduleGroupService.execute with id and UpdateModuleGroupDto and return updated group', async () => {
    const id = '1';
    const dto: UpdateModuleGroupDto = {
      key: 'settings_updated',
      translates: [
        { key: 'key', es: 'Ajustes Modificado', en: 'Updated Settings' },
      ],
    };

    const mockUpdatedGroup = {
      id: '1',
      key: 'settings_updated',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      translates: [
        { key: 'key', es: 'Ajustes Modificado', en: 'Updated Settings' },
      ],
    };

    vi.mocked(moduleGroupServiceMock.execute!).mockResolvedValue(
      mockUpdatedGroup as any,
    );

    const result = await useCase.execute(id, dto, actorFixture('1'));

    expect(moduleGroupServiceMock.execute).toHaveBeenCalledTimes(1);
    expect(moduleGroupServiceMock.execute).toHaveBeenCalledWith(
      id,
      dto,
      actorFixture('1'),
    );
    expect(result).toEqual(mockUpdatedGroup);
  });
});
