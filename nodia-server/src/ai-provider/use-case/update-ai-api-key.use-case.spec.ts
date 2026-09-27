import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateAiApiKeyUseCase } from './update-ai-api-key.use-case.js';
import type { AiProviderService } from '../ai-provider.service.js';
import type { UpdateAiApiKeyDto } from '../dto/update-ai-api-key.dto.js';
import type { AiApiKey } from '../entities/ai-api-key.entity.js';
import { AiKeyHealthState } from '../types/ai-provider.types.js';

describe('UpdateAiApiKeyUseCase', () => {
  let useCase: UpdateAiApiKeyUseCase;
  let serviceMock: Partial<AiProviderService>;

  beforeEach(() => {
    serviceMock = {
      updateApiKey: vi.fn(),
    };
    useCase = new UpdateAiApiKeyUseCase(serviceMock as AiProviderService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call aiProviderService.updateApiKey with id and dto and return the updated key', async () => {
    const dto: UpdateAiApiKeyDto = {
      label: 'Updated Label',
      health_state: AiKeyHealthState.VALID,
    };
    const mockKey = {
      id: '1',
      provider_id: '1',
      label: 'Updated Label',
      display_hint: '...7890',
      is_selected: true,
      health_state: AiKeyHealthState.VALID,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    } as AiApiKey;

    vi.mocked(serviceMock.updateApiKey!).mockResolvedValue(mockKey);

    const result = await useCase.execute('1', dto);

    expect(serviceMock.updateApiKey).toHaveBeenCalledWith('1', dto);
    expect(result).toEqual(mockKey);
  });
});
