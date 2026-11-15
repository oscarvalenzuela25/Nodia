/** Human configuration preferences, never evidence of support or inference. */
export const AGENTIC_REASONING_PREFERENCES = {
  // Codex 0.161.0 protocol/src/openai_models.rs accepts these exact wire values.
  openai: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'],
  gemini: ['low', 'medium', 'high'],
} as const;

export function agenticReasoningPreferences(provider: string): readonly string[] {
  return provider === 'openai' ? AGENTIC_REASONING_PREFERENCES.openai
    : provider === 'gemini' ? AGENTIC_REASONING_PREFERENCES.gemini : [];
}
