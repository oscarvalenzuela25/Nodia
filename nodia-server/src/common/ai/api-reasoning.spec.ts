import { describe, expect, it } from 'vitest';
import { apiReasoningPreferences, isApiThinkingLevel } from './api-reasoning.js';

describe('API reasoning protocol boundary', () => {
  it('distinguishes implemented provider preferences without manufacturing model capability', () => {
    expect(apiReasoningPreferences('openai')).toEqual(['low', 'medium', 'high', 'xhigh', 'max']);
    expect(apiReasoningPreferences('gemini')).toEqual(['low', 'medium', 'high']);
    expect(apiReasoningPreferences('unconfigured')).toEqual([]);
  });
  it.each(['xhigh', 'max'])('permits %s only through OpenAI API and never remaps it', level => {
    expect(isApiThinkingLevel('openai', level)).toBe(true);
    expect(isApiThinkingLevel('gemini', level)).toBe(false);
  });
  it.each(['ultra', 'HIGH', '', null, {}, false])('rejects unimplemented or malformed preference %j', level => {
    expect(isApiThinkingLevel('openai', level)).toBe(false);
  });
});
