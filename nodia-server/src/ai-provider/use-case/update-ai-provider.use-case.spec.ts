import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateAiProviderUseCase } from './update-ai-provider.use-case.js';
import type { AiProviderService } from '../ai-provider.service.js';
import type { UpdateAiProviderDto } from '../dto/update-ai-provider.dto.js';
import type { AiProvider } from '../entities/ai-provider.entity.js';

describe('UpdateAiProviderUseCase', () => {
  let useCase: UpdateAiProviderUseCase;
  let serviceMock: Partial<AiProviderService>;

  beforeEach(() => {
    serviceMock = {
      updateProvider: vi.fn(),
    };
    useCase = new UpdateAiProviderUseCase(serviceMock as AiProviderService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call aiProviderService.updateProvider with id and dto and return the updated provider', async () => {
    const dto: UpdateAiProviderDto = { is_active: false };
    const mockProvider = {
      id: '1',
      key: 'gemini',
      is_active: false,
      created_at: new Date(),
      updated_at: new Date(),
    } as AiProvider;

    vi.mocked(serviceMock.updateProvider!).mockResolvedValue(mockProvider);

    const result = await useCase.execute('1', dto);

    expect(serviceMock.updateProvider).toHaveBeenCalledWith('1', dto);
    expect(result).toEqual(mockProvider);
  });
});
