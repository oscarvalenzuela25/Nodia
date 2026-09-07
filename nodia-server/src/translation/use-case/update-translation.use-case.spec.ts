import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateTranslationUseCase } from './update-translation.use-case.js';
import type { TranslationService } from '../translation.service.js';
import type { UpdateTranslationDto } from '../dto/update-translation.dto.js';
import type { Translation } from '../entities/translation.entity.js';

describe('UpdateTranslationUseCase', () => {
  let useCase: UpdateTranslationUseCase;
  let translationServiceMock: Partial<TranslationService>;

  beforeEach(() => {
    translationServiceMock = {
      update: vi.fn(),
    };
    useCase = new UpdateTranslationUseCase(
      translationServiceMock as TranslationService,
    );
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call translationService.update and return updated translation', async () => {
    const id = '1';
    const dto: UpdateTranslationDto = {
      value: 'Admin Modificado',
    };

    const mockUpdated: Translation = {
      id: '1',
      key: 'roles.admin',
      locale: 'es',
      value: 'Admin Modificado',
      created_at: new Date(),
      updated_at: new Date(),
    };

    vi.mocked(translationServiceMock.update!).mockResolvedValue(mockUpdated);

    const result = await useCase.execute(id, dto);

    expect(translationServiceMock.update).toHaveBeenCalledTimes(1);
    expect(translationServiceMock.update).toHaveBeenCalledWith(id, dto);
    expect(result).toEqual(mockUpdated);
  });
});
