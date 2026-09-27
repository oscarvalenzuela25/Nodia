import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAllAiApiKeysUseCase } from './get-all-ai-api-keys.use-case.js';
import type { AiProviderService } from '../ai-provider.service.js';
import type { GetAiApiKeysDto } from '../dto/get-ai-api-keys.dto.js';
import type { GetAiApiKeysResponse } from '../types/ai-provider.types.js';
import { AiKeyHealthState } from '../types/ai-provider.types.js';

describe('GetAllAiApiKeysUseCase', () => {
  let useCase: GetAllAiApiKeysUseCase;
  let serviceMock: Partial<AiProviderService>;

  beforeEach(() => {
    serviceMock = {
      findAllApiKeys: vi.fn(),
    };
    useCase = new GetAllAiApiKeysUseCase(serviceMock as AiProviderService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call aiProviderService.findAllApiKeys and return response', async () => {
    const dto: GetAiApiKeysDto = { page: 1, limit: 10, all: false };
    const mockResponse: GetAiApiKeysResponse = {
      data: [
        {
          id: '1',
          provider_id: '1',
          label: 'Primary Key',
          secret_ciphertext: 'enc',
          secret_fingerprint: 'fp',
          display_hint: '...a1b2',
          sort_order: 0,
          is_selected: true,
          health_state: AiKeyHealthState.VALID,
          last_error_code: null,
          last_error_message: null,
          last_error_at: null,
          last_success_at: null,
          cooldown_until: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          events: [],
        },
      ],
      meta: { page: 1, limit: 10, total_items: 1, total_pages: 1 },
    };

    vi.mocked(serviceMock.findAllApiKeys!).mockResolvedValue(mockResponse);

    const result = await useCase.execute(dto);

    expect(serviceMock.findAllApiKeys).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponse);
  });
});
