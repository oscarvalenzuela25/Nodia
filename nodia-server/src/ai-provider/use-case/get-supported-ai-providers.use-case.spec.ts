import { describe, it, expect } from 'vitest';
import { GetSupportedAiProvidersUseCase } from './get-supported-ai-providers.use-case.js';

describe('GetSupportedAiProvidersUseCase', () => {
  it('should return supported AI providers including gemini and mistral with connection modes', async () => {
    const useCase = new GetSupportedAiProvidersUseCase();
    const providers = await useCase.execute();

    expect(Array.isArray(providers)).toBe(true);
    expect(providers.length).toBeGreaterThanOrEqual(2);

    const gemini = providers.find((p) => p.key === 'gemini');
    expect(gemini).toBeDefined();
    expect(gemini?.key).toBe('gemini');
    expect(gemini?.defaultMode).toBe('web_session');

    const mistral = providers.find((p) => p.key === 'mistral');
    expect(mistral).toBeDefined();
    expect(mistral?.key).toBe('mistral');
    expect(mistral?.defaultMode).toBe('api_key');
  });
});
