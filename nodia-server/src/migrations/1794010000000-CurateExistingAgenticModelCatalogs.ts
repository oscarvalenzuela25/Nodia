import type { MigrationInterface, QueryRunner } from 'typeorm';

// One-time connection configuration. These IDs were observed in Nodia's
// Gemini discovery and in Codex 0.171.0 model/list on Linux, respectively.
const GEMINI_MODEL_ID = 'gemini-4-hydrogen-high';
const CODEX_MODELS = [
  { id: 'gpt-6-luna', name: 'GPT-6-Luna', supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max'] },
  { id: 'gpt-6.1-terra', name: 'GPT-6.1 Terra', supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'] },
  { id: 'gpt-6.2-sol', name: 'GPT-6.2-Sol', supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'] },
];
const MODEL_FIELDS = new Set([
  'allowed_model_ids', 'available_models', 'selected_model', 'default_model', 'model',
  'chat_model', 'ocr_model', 'ocr_focus_model', 'thinking_level', 'thinking_levels',
  'enable_extended_thinking',
]);

type Fields = Record<string, unknown>;
type Connection = {
  id: string;
  key: 'gemini' | 'google' | 'openai';
  fields: Fields;
  default_mode: 'api_key' | 'agentic' | null;
  use_api_key: boolean;
};

function record(value: unknown): Fields | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Fields
    : undefined;
}

function modelFields(fields: Fields, keep: boolean): Fields {
  return Object.fromEntries(Object.entries(fields).filter(([key]) => MODEL_FIELDS.has(key) === keep));
}

function curatedCodexFields(previous: Fields): Fields {
  const models = new Map(CODEX_MODELS.map(model => [model.id, model]));
  const existingModels = new Map(
    (Array.isArray(previous.available_models) ? previous.available_models : [])
      .flatMap((value: unknown) => {
        const model = record(value);
        return model && typeof model.id === 'string' ? [[model.id, model] as const] : [];
      }),
  );
  const permitted = (value: unknown) => typeof value === 'string' && models.has(value) ? value : null;
  const selected = permitted(previous.selected_model ?? previous.model ?? previous.chat_model ?? previous.default_model);
  const savedEffort = previous.thinking_level;
  const thinkingLevels = Object.fromEntries(
    Object.entries(record(previous.thinking_levels) ?? {}).filter(([id, effort]) => {
      const model = models.get(id);
      return model && (effort === null || typeof effort === 'string' && model.supportedReasoningEfforts.includes(effort));
    }),
  );
  const active = selected ? models.get(selected) : undefined;
  return {
    ...modelFields(previous, false),
    allowed_model_ids: [...models.keys()],
    available_models: CODEX_MODELS.map(model => ({ ...existingModels.get(model.id), ...model, displayName: model.name })),
    selected_model: selected,
    ocr_model: permitted(previous.ocr_model),
    ocr_focus_model: permitted(previous.ocr_focus_model),
    thinking_levels: thinkingLevels,
    ...(active && typeof savedEffort === 'string' && active.supportedReasoningEfforts.includes(savedEffort)
      ? { thinking_level: savedEffort }
      : {}),
    ...(active && typeof previous.enable_extended_thinking === 'boolean'
      ? { enable_extended_thinking: previous.enable_extended_thinking }
      : {}),
  };
}

function curateConnection(connection: Connection): Fields {
  const current = record(connection.fields);
  if (!current) throw new Error('agentic_models:invalid_connection_fields');
  const savedAgentic = record(current.agentic);
  const savedApi = record(current.api_key);
  const scoped = Boolean(savedAgentic || savedApi);
  const legacyApi = connection.default_mode === 'api_key' || (!connection.default_mode && connection.use_api_key);
  const previousAgentic = savedAgentic ?? (!scoped && !legacyApi ? modelFields(current, true) : {});
  const next = legacyApi ? { ...current } : modelFields(current, false);
  if (!scoped && connection.use_api_key && legacyApi) {
    next.api_key = modelFields(current, true);
  }
  next.agentic = connection.key === 'openai'
    ? curatedCodexFields(previousAgentic)
    : {
      ...modelFields(previousAgentic, false),
      allowed_model_ids: [GEMINI_MODEL_ID],
      available_models: [],
      selected_model: null,
      ocr_model: null,
      ocr_focus_model: null,
    };
  return next;
}

export class CurateExistingAgenticModelCatalogs1794010000000 implements MigrationInterface {
  name = 'CurateExistingAgenticModelCatalogs1794010000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query("SET LOCAL lock_timeout = '5s'");
    const connections: Connection[] = await runner.query(`
      SELECT provider.id::text, catalog.key, provider.fields, provider.default_mode, provider.use_api_key
      FROM ai_providers provider
      JOIN ai_provider_catalog catalog ON catalog.id = provider.catalog_id
      WHERE catalog.key IN ('gemini', 'google', 'openai')
        AND (provider.use_agentic OR provider.default_mode = 'agentic' OR provider.fields ? 'agentic')
      ORDER BY provider.id
      FOR UPDATE OF provider
    `);

    for (const connection of connections) {
      const fields = curateConnection(connection);
      await runner.query(`
        UPDATE ai_providers SET fields = $2::jsonb, updated_at = now()
        WHERE id = $1 AND fields IS DISTINCT FROM $2::jsonb
      `, [connection.id, JSON.stringify(fields)]);
    }
  }

  async down(): Promise<void> {
    // The retired selections and preferences are deliberately not retained.
    throw new Error('agentic_models:restore_provider_configuration_from_pre_release_backup');
  }
}
