import { Injectable } from '@nestjs/common';
import { AiProviderService } from '../../../ai-provider/ai-provider.service.js';
import { AiProvider } from '../../../ai-provider/entities/ai-provider.entity.js';
import { AiApiKey } from '../../../ai-provider/entities/ai-api-key.entity.js';
import { AiProviderCatalog } from '../../../ai-provider/entities/ai-provider-catalog.entity.js';
import { AiProviderEvent } from '../../../ai-provider/entities/ai-provider-event.entity.js';
import { Translation } from '../../../translation/entities/translation.entity.js';
import { TranslationService } from '../../../translation/translation.service.js';
import { GetAllAiProvidersUseCase } from '../../../ai-provider/use-case/get-all-ai-providers.use-case.js';
import { GetAllAiApiKeysUseCase } from '../../../ai-provider/use-case/get-all-ai-api-keys.use-case.js';
import { GetAllAiProviderEventsUseCase } from '../../../ai-provider/use-case/get-all-ai-provider-events.use-case.js';
import { GetAiProviderCatalogUseCase } from '../../../ai-provider/use-case/get-ai-provider-catalog.use-case.js';
import { GetSupportedAiProvidersUseCase } from '../../../ai-provider/use-case/get-supported-ai-providers.use-case.js';
import type { NodiaAiToolHandlerContext } from '../../../nodia-ai-tools/types/tool-registry.types.js';
import type {
  NodiaAiJsonObject,
  NodiaAiJsonValue,
} from '../../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

export type AiSettingsOperation =
  'providers' | 'keys' | 'events' | 'catalog' | 'supported';
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('nodia_ai:invalid_tool_output');
  return value as Record<string, unknown>;
}
function nullable(value: unknown): NodiaAiJsonValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (['string', 'boolean', 'number'].includes(typeof value))
    return value as string | boolean | number;
  throw new Error('nodia_ai:invalid_tool_output');
}
const projection = (
  value: unknown,
  fields: readonly string[],
): NodiaAiJsonObject => {
  const row = object(value);
  return Object.fromEntries(fields.map((key) => [key, nullable(row[key])]));
};

/** Local configuration is not evidence of authentication, health or inference. */
@Injectable()
export class ReadNodiaAiAiSettingsUseCase {
  async execute(
    operation: AiSettingsOperation,
    input: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ): Promise<NodiaAiJsonObject> {
    const manager = context.manager;
    const service = new AiProviderService(
      manager.getRepository(AiProvider),
      manager.getRepository(AiApiKey),
      manager.getRepository(AiProviderEvent),
      manager.getRepository(AiProviderCatalog),
      new TranslationService(manager.getRepository(Translation)),
    );
    if (operation === 'supported') {
      const rows = await new GetSupportedAiProvidersUseCase().execute();
      if (rows.length > 100) throw new Error('nodia_ai:context_limit');
      return {
        items: rows.map((row) => ({
          key: row.key,
          name: row.name,
          description: row.description,
          default_mode: row.defaultMode,
          supported_modes: [...row.supportedModes],
        })),
      };
    }
    if (operation === 'catalog') {
      const rows = await new GetAiProviderCatalogUseCase(service).execute(100);
      return {
        items: rows.map((row) =>
          projection(row, [
            'id',
            'key',
            'name',
            'is_active',
            'can_use_api_key',
            'can_use_token_plan_web',
            'can_use_token_plan_agentic',
          ]),
        ),
      };
    }
    const activity = input.activity ?? 'active';
    const q = {
      ...object(input.q ?? {}),
      ...(activity === 'all' ? {} : { is_active_eq: activity === 'active' }),
    };
    const query = {
      page: (input.page ?? 1) as number,
      limit: (input.limit ?? 25) as number,
      all: false,
      includes: false,
      q,
    };
    const response =
      operation === 'providers'
        ? await new GetAllAiProvidersUseCase(service).execute(query)
        : operation === 'keys'
          ? await new GetAllAiApiKeysUseCase(service).execute(query)
          : await new GetAllAiProviderEventsUseCase(service).execute(query);
    const fields =
      operation === 'providers'
        ? [
            'id',
            'catalog_id',
            'name',
            'key',
            'is_active',
            'is_default',
            'use_api_key',
            'use_token_plan_web',
            'use_token_plan_agentic',
            'default_mode',
            'auto_rotate_api_keys',
          ]
        : operation === 'keys'
          ? [
              'id',
              'provider_id',
              'label',
              'display_hint',
              'sort_order',
              'is_selected',
              'is_active',
              'health_state',
              'cooldown_until',
              'last_success_at',
              'last_error_at',
              'last_error_code',
            ]
          : [
              'id',
              'provider_id',
              'api_key_id',
              'actor_user_id',
              'event_type',
              'reason_code',
              'created_at',
              'is_active',
            ];
    // Never copy fields, metadata, message, ciphertext, fingerprint or arbitrary relations.
    return {
      data: response.data.map((row) => projection(row, fields)),
      meta: projection(response.meta, [
        'page',
        'limit',
        'total_items',
        'total_pages',
      ]),
    };
  }
}
