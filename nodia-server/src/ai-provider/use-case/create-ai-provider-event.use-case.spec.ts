import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateAiProviderEventUseCase } from './create-ai-provider-event.use-case.js';
import type { AiProviderService } from '../ai-provider.service.js';
import type { CreateAiProviderEventDto } from '../dto/create-ai-provider-event.dto.js';
import type { AiProviderEvent } from '../entities/ai-provider-event.entity.js';

describe('CreateAiProviderEventUseCase', () => {
  let useCase: CreateAiProviderEventUseCase;
  let serviceMock: Partial<AiProviderService>;

  beforeEach(() => {
    serviceMock = {
      createEvent: vi.fn(),
    };
    useCase = new CreateAiProviderEventUseCase(
      serviceMock as AiProviderService,
    );
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call aiProviderService.createEvent and return created event', async () => {
    const dto: CreateAiProviderEventDto = {
      provider_id: '1',
      event_type: 'LOGIN_ATTEMPT',
      message: 'Operator initiated remote session',
    };
    const mockEvent = {
      id: '1',
      provider_id: '1',
      event_type: 'LOGIN_ATTEMPT',
      message: 'Operator initiated remote session',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    } as AiProviderEvent;

    vi.mocked(serviceMock.createEvent!).mockResolvedValue(mockEvent);

    const result = await useCase.execute(dto);

    expect(serviceMock.createEvent).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockEvent);
  });
});
