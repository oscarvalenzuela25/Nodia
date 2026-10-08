import { describe, it, expect } from 'vitest';
import { GetSupportedAiProvidersUseCase } from './get-supported-ai-providers.use-case.js';

describe('GetSupportedAiProvidersUseCase', () => {
  it('advertises implemented Gemini and OpenAI channels without invented models', async () => {
    const useCase = new GetSupportedAiProvidersUseCase();
    const providers = await useCase.execute();

    expect(Array.isArray(providers)).toBe(true);
    expect(providers).toHaveLength(2);

    const gemini = providers.find((p) => p.key === 'gemini');
    expect(gemini).toBeDefined();
    expect(gemini?.key).toBe('gemini');
    expect(gemini?.defaultMode).toBe('web_session');

    expect(gemini?.supportedModes).toEqual(['web_session', 'api_key']);
    expect(gemini?.defaultEngine).toBe('web');
    expect(gemini?.availableModels).toBeUndefined();
    expect(providers.find((p) => p.key === 'mistral')).toBeUndefined();
    expect(providers.find((p) => p.key === 'openai')).toMatchObject({ supportedModes: ['api_key'], defaultMode: 'api_key' });
  });
});
