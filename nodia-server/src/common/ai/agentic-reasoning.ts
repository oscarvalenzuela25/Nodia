/** Human configuration preferences, never evidence of support or inference. */
const geminiPreferences = ['low', 'medium', 'high'] as const;

export const AGENTIC_REASONING_PREFERENCES = {
  // Codex 0.161.0 protocol/src/openai_models.rs accepts these exact wire values.
  openai: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'],
  gemini: geminiPreferences,
} as const;

export type GeminiAgenticEffort = typeof geminiPreferences[number] | 'xhigh';

export function geminiAgenticVariantEffort(id: string, label: string): GeminiAgenticEffort | undefined {
  const suffix = / \(([^()]+)\)$/.exec(label)?.[1].toLowerCase();
  const effort = suffix === 'extra' || suffix === 'extra high' || suffix === 'xhigh'
    ? 'xhigh' : geminiPreferences.find(level => level === suffix);
  return effort && id.length > effort.length + 1 && id.endsWith(`-${effort}`) ? effort : undefined;
}

export function isGeminiAgenticEffort(value: unknown, model: unknown): value is GeminiAgenticEffort {
  // The private runtime also checks the exact ID against live discovery and the /model receipt.
  return geminiPreferences.some(level => level === value) ||
    (value === 'xhigh' && typeof model === 'string' && model.endsWith('-xhigh') && model.length > '-xhigh'.length);
}

export function agenticReasoningPreferences(provider: string): readonly string[] {
  return provider === 'openai' ? AGENTIC_REASONING_PREFERENCES.openai
    : provider === 'gemini' ? AGENTIC_REASONING_PREFERENCES.gemini : [];
}
