import { BadGatewayException } from '@nestjs/common';

export function observedModels(value: unknown) {
  if (!Array.isArray(value)) throw new BadGatewayException('Gemini devolvió un catálogo de modelos inválido.');
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || !('id' in entry) || typeof entry.id !== 'string' || !entry.id.trim()) {
      throw new BadGatewayException('Gemini devolvió un identificador de modelo inválido.');
    }
    const model = entry as Record<string, unknown>;
    const context = model.context_window ?? model.contextWindow;
    const role: 'chat' | 'multimodal' | 'ocr' | null = model.role === 'chat' || model.role === 'multimodal' || model.role === 'ocr' ? model.role : null;
    return {
      id: entry.id,
      name: typeof model.name === 'string' ? model.name : entry.id,
      displayName: typeof (model.display_name ?? model.displayName) === 'string'
        ? String(model.display_name ?? model.displayName) : typeof model.name === 'string' ? model.name : entry.id,
      description: typeof model.description === 'string' ? model.description : '',
      contextWindow: typeof context === 'number' && Number.isFinite(context) && context > 0 ? context : null,
      capabilities: Array.isArray(model.capabilities) ? model.capabilities.filter((v): v is string => typeof v === 'string') : [],
      isRecommended: model.isRecommended === true,
      ...(role ? { role } : {}),
    };
  });
}

// Saved fields are configuration, not evidence of current provider limits or
// capabilities. Older releases persisted values inferred from model names.
export function configuredModelFields(fields: Record<string, unknown>) {
  const result = { ...fields };
  for (const key of ['quota', 'quotas', 'usage_info', 'usage_percentage', 'remaining_credits', 'total_credits', 'rateLimits']) delete result[key];
  if (Array.isArray(fields.available_models)) {
    result.available_models = fields.available_models.flatMap((entry: unknown) => {
      if (!entry || typeof entry !== 'object' || !('id' in entry) || typeof entry.id !== 'string') return [];
      const model = entry as Record<string, unknown>;
      return [{ id: entry.id, name: typeof model.name === 'string' ? model.name : entry.id,
        displayName: typeof model.displayName === 'string' ? model.displayName : entry.id,
        description: '', contextWindow: null, capabilities: [], isRecommended: false }];
    });
  }
  for (const mode of ['token_plan_web', 'token_plan_agentic', 'api_key']) {
    const scoped = fields[mode];
    if (scoped && typeof scoped === 'object' && !Array.isArray(scoped)) result[mode] = configuredModelFields(scoped as Record<string, unknown>);
  }
  return result;
}
