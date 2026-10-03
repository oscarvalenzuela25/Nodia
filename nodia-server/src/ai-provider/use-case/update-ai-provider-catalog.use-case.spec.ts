import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateAiProviderCatalogUseCase } from './update-ai-provider-catalog.use-case.js';
import type { AiProviderService } from '../ai-provider.service.js';
import type { UpdateAiProviderCatalogDto } from '../dto/update-ai-provider-catalog.dto.js';

describe('UpdateAiProviderCatalogUseCase', () => {
  let useCase: UpdateAiProviderCatalogUseCase;
  let aiProviderServiceMock: Partial<AiProviderService>;

  beforeEach(() => {
    aiProviderServiceMock = {
      updateCatalog: vi.fn(),
    };
    useCase = new UpdateAiProviderCatalogUseCase(
      aiProviderServiceMock as AiProviderService,
    );
  });

  it('should delegate catalog update to aiProviderService', async () => {
    const dto: UpdateAiProviderCatalogDto = {
      name: 'Google Gemini Pro',
      can_use_token_plan_agentic: true,
    };

    const updatedCatalog = {
      id: '1',
      key: 'gemini',
      name: 'Google Gemini Pro',
      can_use_api_key: true,
      can_use_token_plan_web: true,
      can_use_token_plan_agentic: true,
      created_at: new Date(),
      updated_at: new Date(),
      providers: [],
    };

    vi.mocked(aiProviderServiceMock.updateCatalog!).mockResolvedValue(
      updatedCatalog as any,
    );

    const result = await useCase.execute('1', dto);

    expect(aiProviderServiceMock.updateCatalog).toHaveBeenCalledWith('1', dto);
    expect(result).toEqual(updatedCatalog);
  });
});
