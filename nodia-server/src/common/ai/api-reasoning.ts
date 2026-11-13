/** API protocol preferences, never a claim about a model discovered by /models. */
export const OPENAI_API_REASONING_PREFERENCES = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export const GEMINI_API_REASONING_PREFERENCES = ['low', 'medium', 'high'] as const;
export type ApiThinkingLevel = typeof OPENAI_API_REASONING_PREFERENCES[number];

export function apiReasoningPreferences(provider: string): readonly ApiThinkingLevel[] {
  return provider === 'openai' ? OPENAI_API_REASONING_PREFERENCES
    : provider === 'gemini' ? GEMINI_API_REASONING_PREFERENCES : [];
}

export function isApiThinkingLevel(provider: string, value: unknown): value is ApiThinkingLevel {
  return typeof value === 'string' && apiReasoningPreferences(provider).some(item => item === value);
}
