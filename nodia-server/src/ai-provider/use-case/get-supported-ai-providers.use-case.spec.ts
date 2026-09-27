import { describe, it, expect } from 'vitest';
import { GetSupportedAiProvidersUseCase } from './get-supported-ai-providers.use-case.js';

describe('GetSupportedAiProvidersUseCase', () => {
  it('should return supported AI providers including gemini and mistral', async () => {
    const useCase = new GetSupportedAiProvidersUseCase();
    const providers = await useCase.execute();

    expect(Array.isArray(providers)).toBe(true);
    expect(providers.length).toBeGreaterThanOrEqual(2);

    const gemini = providers.find((p) => p.key === 'gemini');
    expect(gemini).toBeDefined();
    expect(gemini?.defaultSelectedModel).toBe('gemini-flash');
    expect(gemini?.availableModels.length).toBeGreaterThan(0);

    const mistral = providers.find((p) => p.key === 'mistral');
    expect(mistral).toBeDefined();
    expect(mistral?.defaultSelectedModel).toBe('mistral-large-latest');
    expect(mistral?.availableModels.length).toBeGreaterThan(0);
  });
});
