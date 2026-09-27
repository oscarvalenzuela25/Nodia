import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAllAiProvidersUseCase } from './get-all-ai-providers.use-case.js';
import type { AiProviderService } from '../ai-provider.service.js';
import type { GetAiProvidersDto } from '../dto/get-ai-providers.dto.js';
import type { GetAiProvidersResponse } from '../types/ai-provider.types.js';

describe('GetAllAiProvidersUseCase', () => {
  let useCase: GetAllAiProvidersUseCase;
  let serviceMock: Partial<AiProviderService>;

  beforeEach(() => {
    serviceMock = {
      findAllProviders: vi.fn(),
    };
    useCase = new GetAllAiProvidersUseCase(serviceMock as AiProviderService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call aiProviderService.findAllProviders with provided query and return response', async () => {
    const dto: GetAiProvidersDto = { page: 1, limit: 10, all: false };
    const mockResponse: GetAiProvidersResponse = {
      data: [
        {
          id: '1',
          key: 'gemini',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          connections: [],
          events: [],
        },
      ],
      meta: { page: 1, limit: 10, total_items: 1, total_pages: 1 },
    };

    vi.mocked(serviceMock.findAllProviders!).mockResolvedValue(mockResponse);

    const result = await useCase.execute(dto);

    expect(serviceMock.findAllProviders).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponse);
  });
});
