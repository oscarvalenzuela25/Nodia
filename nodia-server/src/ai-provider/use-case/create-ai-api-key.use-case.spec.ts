import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateAiApiKeyUseCase } from './create-ai-api-key.use-case.js';
import type { AiProviderService } from '../ai-provider.service.js';
import type { CreateAiApiKeyDto } from '../dto/create-ai-api-key.dto.js';
import type { AiApiKey } from '../entities/ai-api-key.entity.js';
import { AiKeyHealthState } from '../types/ai-provider.types.js';

describe('CreateAiApiKeyUseCase', () => {
  let useCase: CreateAiApiKeyUseCase;
  let serviceMock: Partial<AiProviderService>;

  beforeEach(() => {
    serviceMock = {
      createApiKey: vi.fn(),
    };
    useCase = new CreateAiApiKeyUseCase(serviceMock as AiProviderService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call aiProviderService.createApiKey and return the key', async () => {
    const dto: CreateAiApiKeyDto = {
      provider_id: '1',
      label: 'New Key',
      secret: 'sk-1234567890',
      is_selected: true,
    };
    const mockKey = {
      id: '1',
      provider_id: '1',
      label: 'New Key',
      display_hint: '...7890',
      is_selected: true,
      health_state: AiKeyHealthState.UNTESTED,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      secret_ciphertext: 'encrypted-sensitive-value',
      secret_fingerprint: 'sensitive-fingerprint',
    } as AiApiKey;

    vi.mocked(serviceMock.createApiKey!).mockResolvedValue(mockKey);

    const result = await useCase.execute(dto);

    expect(serviceMock.createApiKey).toHaveBeenCalledWith(dto);
    expect(result).not.toHaveProperty('secret_ciphertext');
    expect(result).not.toHaveProperty('secret_fingerprint');
    expect(result).toMatchObject({
      id: mockKey.id,
      display_hint: mockKey.display_hint,
    });
  });
});
