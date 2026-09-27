import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GetEnabledWebAiProvidersUseCase } from './get-enabled-web-ai-providers.use-case.js';

describe('GetEnabledWebAiProvidersUseCase', () => {
  let useCase: GetEnabledWebAiProvidersUseCase;
  const originalEnv = process.env.ENABLED_WEB_AI_PROVIDERS;

  beforeEach(() => {
    useCase = new GetEnabledWebAiProvidersUseCase();
  });

  afterEach(() => {
    process.env.ENABLED_WEB_AI_PROVIDERS = originalEnv;
  });

  it('should return empty array if env is not set or empty', async () => {
    delete process.env.ENABLED_WEB_AI_PROVIDERS;
    const result = await useCase.execute();
    expect(result).toEqual({ enabled_providers: [] });

    process.env.ENABLED_WEB_AI_PROVIDERS = '';
    const result2 = await useCase.execute();
    expect(result2).toEqual({ enabled_providers: [] });
  });

  it('should return parsed array from comma-separated string in lowercase', async () => {
    process.env.ENABLED_WEB_AI_PROVIDERS = 'gemini, openai, MISTRAL';
    const result = await useCase.execute();
    expect(result).toEqual({ enabled_providers: ['gemini', 'openai', 'mistral'] });
  });

  it('should return parsed array from JSON array string in lowercase', async () => {
    process.env.ENABLED_WEB_AI_PROVIDERS = '["gemini", "ANTHROPIC"]';
    const result = await useCase.execute();
    expect(result).toEqual({ enabled_providers: ['gemini', 'anthropic'] });
  });
});
