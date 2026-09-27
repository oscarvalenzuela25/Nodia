import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAllAiProviderEventsUseCase } from './get-all-ai-provider-events.use-case.js';
import type { AiProviderService } from '../ai-provider.service.js';
import type { GetAiProviderEventsDto } from '../dto/get-ai-provider-events.dto.js';
import type { GetAiProviderEventsResponse } from '../types/ai-provider.types.js';

describe('GetAllAiProviderEventsUseCase', () => {
  let useCase: GetAllAiProviderEventsUseCase;
  let serviceMock: Partial<AiProviderService>;

  beforeEach(() => {
    serviceMock = {
      findAllEvents: vi.fn(),
    };
    useCase = new GetAllAiProviderEventsUseCase(
      serviceMock as AiProviderService,
    );
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call aiProviderService.findAllEvents and return response', async () => {
    const dto: GetAiProviderEventsDto = { page: 1, limit: 10, all: false };
    const mockResponse: GetAiProviderEventsResponse = {
      data: [
        {
          id: '1',
          provider_id: '1',
          connection_id: '1',
          api_key_id: '1',
          actor_user_id: null,
          event_type: 'KEY_ROTATION',
          reason_code: 'QUOTA_EXHAUSTED',
          message: 'Key rotated due to quota',
          metadata: {},
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      meta: { page: 1, limit: 10, total_items: 1, total_pages: 1 },
    };

    vi.mocked(serviceMock.findAllEvents!).mockResolvedValue(mockResponse);

    const result = await useCase.execute(dto);

    expect(serviceMock.findAllEvents).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponse);
  });
});
