import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateTranslationUseCase } from './create-translation.use-case.js';
import type { TranslationService } from '../translation.service.js';
import type { CreateTranslationDto } from '../dto/create-translation.dto.js';
import type { Translation } from '../entities/translation.entity.js';

describe('CreateTranslationUseCase', () => {
  let useCase: CreateTranslationUseCase;
  let translationServiceMock: Partial<TranslationService>;

  beforeEach(() => {
    translationServiceMock = {
      create: vi.fn(),
    };
    useCase = new CreateTranslationUseCase(
      translationServiceMock as TranslationService,
    );
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call translationService.create and return created translation', async () => {
    const dto: CreateTranslationDto = {
      key: 'roles.admin',
      locale: 'es',
      value: 'Administrador',
    };

    const mockCreated: Translation = {
      id: '1',
      key: 'roles.admin',
      locale: 'es',
      value: 'Administrador',
      created_at: new Date(),
      updated_at: new Date(),
    };

    vi.mocked(translationServiceMock.create!).mockResolvedValue(mockCreated);

    const result = await useCase.execute(dto);

    expect(translationServiceMock.create).toHaveBeenCalledTimes(1);
    expect(translationServiceMock.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockCreated);
  });
});
