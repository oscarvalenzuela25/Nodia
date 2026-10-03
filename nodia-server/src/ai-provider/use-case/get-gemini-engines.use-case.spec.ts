import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetGeminiEnginesUseCase } from './get-gemini-engines.use-case.js';
import type { GeminiService } from '../../common/ai/gemini.service.js';

describe('GetGeminiEnginesUseCase', () => {
  let useCase: GetGeminiEnginesUseCase;
  let geminiServiceMock: Partial<GeminiService>;

  beforeEach(() => {
    geminiServiceMock = {
      getDualEngineStatus: vi.fn().mockResolvedValue({
        active_engine: 'agentic',
        agentic: {
          available: true,
          authenticated: true,
          tier: 'ANTIGRAVITY_PRO',
        },
        web: {
          available: true,
          authenticated: true,
        },
      }),
    };

    useCase = new GetGeminiEnginesUseCase(geminiServiceMock as GeminiService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should return dual engine status from geminiService', async () => {
    const result = await useCase.execute();

    expect(geminiServiceMock.getDualEngineStatus).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      active_engine: 'agentic',
      agentic: {
        available: true,
        authenticated: true,
        tier: 'ANTIGRAVITY_PRO',
      },
      web: {
        available: true,
        authenticated: true,
      },
    });
  });
});
