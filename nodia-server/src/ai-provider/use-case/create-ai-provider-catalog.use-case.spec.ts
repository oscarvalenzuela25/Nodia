import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateAiProviderCatalogUseCase } from './create-ai-provider-catalog.use-case.js';
import type { AiProviderService } from '../ai-provider.service.js';
import type { CreateAiProviderCatalogDto } from '../dto/create-ai-provider-catalog.dto.js';

describe('CreateAiProviderCatalogUseCase', () => {
  let useCase: CreateAiProviderCatalogUseCase;
  let aiProviderServiceMock: Partial<AiProviderService>;

  beforeEach(() => {
    aiProviderServiceMock = {
      createCatalog: vi.fn(),
    };
    useCase = new CreateAiProviderCatalogUseCase(
      aiProviderServiceMock as AiProviderService,
    );
  });

  it('should delegate catalog creation to aiProviderService', async () => {
    const dto: CreateAiProviderCatalogDto = {
      key: 'anthropic',
      name: 'Anthropic Claude',
      can_use_api_key: true,
      can_use_token_plan_web: false,
      can_use_token_plan_agentic: false,
    };

    const createdCatalog = {
      id: '3',
      ...dto,
      created_at: new Date(),
      updated_at: new Date(),
      providers: [],
    };

    vi.mocked(aiProviderServiceMock.createCatalog!).mockResolvedValue(
      createdCatalog as any,
    );

    const result = await useCase.execute(dto);

    expect(aiProviderServiceMock.createCatalog).toHaveBeenCalledWith(dto);
    expect(result).toEqual(createdCatalog);
  });
});
