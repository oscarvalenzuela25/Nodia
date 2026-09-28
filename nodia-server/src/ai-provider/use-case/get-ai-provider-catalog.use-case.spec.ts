import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAiProviderCatalogUseCase } from './get-ai-provider-catalog.use-case.js';
import type { AiProviderService } from '../ai-provider.service.js';

describe('GetAiProviderCatalogUseCase', () => {
  let useCase: GetAiProviderCatalogUseCase;
  let aiProviderServiceMock: Partial<AiProviderService>;

  beforeEach(() => {
    aiProviderServiceMock = {
      findAllCatalogs: vi.fn().mockResolvedValue([
        { id: '1', key: 'gemini', name: 'Google Gemini' },
        { id: '2', key: 'openai', name: 'OpenAI' },
      ]),
    };
    useCase = new GetAiProviderCatalogUseCase(
      aiProviderServiceMock as AiProviderService,
    );
  });

  it('should return all catalog items from service', async () => {
    const result = await useCase.execute();

    expect(aiProviderServiceMock.findAllCatalogs).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(2);
    expect(result[0].key).toBe('gemini');
    expect(result[1].key).toBe('openai');
  });
});
