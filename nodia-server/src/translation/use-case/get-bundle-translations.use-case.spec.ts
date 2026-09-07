import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetBundleTranslationsUseCase } from './get-bundle-translations.use-case.js';
import type { TranslationService } from '../translation.service.js';
import type { TranslationsBundleResponse } from '../types/translation.types.js';

describe('GetBundleTranslationsUseCase', () => {
  let useCase: GetBundleTranslationsUseCase;
  let translationServiceMock: Partial<TranslationService>;

  beforeEach(() => {
    translationServiceMock = {
      getBundle: vi.fn(),
    };
    useCase = new GetBundleTranslationsUseCase(
      translationServiceMock as TranslationService,
    );
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call translationService.getBundle and return key-value dictionary', async () => {
    const locale = 'es';
    const mockBundle: TranslationsBundleResponse = {
      locale: 'es',
      translations: {
        'roles.admin': 'Administrador',
        'modules.users': 'Usuarios',
      },
    };

    vi.mocked(translationServiceMock.getBundle!).mockResolvedValue(mockBundle);

    const result = await useCase.execute(locale);

    expect(translationServiceMock.getBundle).toHaveBeenCalledTimes(1);
    expect(translationServiceMock.getBundle).toHaveBeenCalledWith(locale);
    expect(result).toEqual(mockBundle);
  });
});
