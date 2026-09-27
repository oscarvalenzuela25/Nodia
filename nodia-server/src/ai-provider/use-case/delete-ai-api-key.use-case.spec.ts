import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteAiApiKeyUseCase } from './delete-ai-api-key.use-case.js';
import type { AiProviderService } from '../ai-provider.service.js';

describe('DeleteAiApiKeyUseCase', () => {
  let useCase: DeleteAiApiKeyUseCase;
  let serviceMock: Partial<AiProviderService>;

  beforeEach(() => {
    serviceMock = {
      deleteApiKey: vi.fn(),
    };
    useCase = new DeleteAiApiKeyUseCase(serviceMock as AiProviderService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call aiProviderService.deleteApiKey with id', async () => {
    vi.mocked(serviceMock.deleteApiKey!).mockResolvedValue(undefined);

    await useCase.execute('key-123');

    expect(serviceMock.deleteApiKey).toHaveBeenCalledWith('key-123');
  });
});
