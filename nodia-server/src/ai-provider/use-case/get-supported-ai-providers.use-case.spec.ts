import { describe, it, expect } from 'vitest';
import { GetSupportedAiProvidersUseCase } from './get-supported-ai-providers.use-case.js';

describe('GetSupportedAiProvidersUseCase', () => {
  it('advertises only implemented subscription connections without API key engines or invented models', async () => {
    const useCase = new GetSupportedAiProvidersUseCase();
    const providers = await useCase.execute();

    expect(Array.isArray(providers)).toBe(true);
    expect(providers).toHaveLength(1);

    const gemini = providers.find((p) => p.key === 'gemini');
    expect(gemini).toBeDefined();
    expect(gemini?.key).toBe('gemini');
    expect(gemini?.defaultMode).toBe('web_session');

    expect(gemini?.supportedModes).toEqual(['web_session']);
    expect(gemini?.defaultEngine).toBe('web');
    expect(gemini?.availableModels).toBeUndefined();
    expect(providers.find((p) => p.key === 'mistral')).toBeUndefined();
  });
});
