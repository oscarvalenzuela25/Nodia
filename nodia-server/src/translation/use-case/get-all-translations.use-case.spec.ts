import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAllTranslationsUseCase } from './get-all-translations.use-case.js';
import type { TranslationService } from '../translation.service.js';
import type { GetTranslationsDto } from '../dto/get-translations.dto.js';
import type { GetTranslationsResponse } from '../types/translation.types.js';

describe('GetAllTranslationsUseCase', () => {
  let useCase: GetAllTranslationsUseCase;
  let translationServiceMock: Partial<TranslationService>;

  beforeEach(() => {
    translationServiceMock = {
      findAll: vi.fn(),
    };
    useCase = new GetAllTranslationsUseCase(
      translationServiceMock as TranslationService,
    );
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call translationService.findAll with query params and return response', async () => {
    const dto: GetTranslationsDto = {
      page: 1,
      limit: 10,
      all: false,
    };

    const mockResponse: GetTranslationsResponse = {
      data: [
        {
          id: '1',
          key: 'roles.admin',
          locale: 'es',
          value: 'Administrador',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      meta: {
        page: 1,
        limit: 10,
        total_items: 1,
        total_pages: 1,
      },
    };

    vi.mocked(translationServiceMock.findAll!).mockResolvedValue(mockResponse);

    const result = await useCase.execute(dto);

    expect(translationServiceMock.findAll).toHaveBeenCalledTimes(1);
    expect(translationServiceMock.findAll).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponse);
  });
});
