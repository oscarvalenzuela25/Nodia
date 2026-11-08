import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { NodiaAiToolFamily } from '../../nodia-ai-tools/types/tool-registry.types.js';
import { currentActor } from '../../authorization/authority-transaction.js';
import {
  ReadNodiaAiAiSettingsUseCase,
  type AiSettingsOperation,
} from './use-case/read-ai-settings.use-case.js';

export const NODIA_AI_AI_SETTINGS_READS = [
  ['nodia_ai_providers_list', 'Providers', 'providers'],
  ['nodia_api_keys_list', 'Keys', 'keys'],
  ['nodia_ai_events_list', 'Events', 'events'],
  ['nodia_ai_providers_catalog_list', 'Catalog', 'catalog'],
  ['nodia_ai_providers_supported_providers', 'Supported', 'supported'],
] as const;
export const NODIA_AI_AI_SETTINGS_EXTERNAL_GATES = [
  'nodia_ai_providers_health',
  'nodia_ai_providers_gemini_engines',
  'nodia_ai_providers_codex_session',
  'nodia_ai_providers_models',
] as const;

/** Explicit candidate export. Publication requires approved bindings and executable parity. */
export function createNodiaAiAiSettingsReadFamily(
  sourceJson = readFileSync(
    new URL('../contracts/ai-settings.schema.json', import.meta.url),
    'utf8',
  ),
): NodiaAiToolFamily {
  const sourceHash = createHash('sha256').update(sourceJson).digest('hex');
  const reads = new ReadNodiaAiAiSettingsUseCase();
  const route = '/ai-providers';
  return {
    familyKey: 'ai_settings',
    modules: [
      { key: 'ai_providers', route, label: 'AI connection administration' },
    ],
    resources: NODIA_AI_AI_SETTINGS_READS.map(([, , resource]) => ({
      key: `ai_settings_${resource}`,
      label: resource,
      requiredModuleRoutes: [route],
    })),
    capabilities: NODIA_AI_AI_SETTINGS_READS.map(
      ([name, definition, operation]) => ({
        capabilityId: name,
        revision: 1,
        publication: 'published',
        toolName: name,
        kind: 'read',
        moduleKey: 'ai_providers',
        resourceKey: `ai_settings_${operation}`,
        operationKey: 'list',
        descriptionKey: name,
        description: `Read bounded ${operation} metadata. Configuration does not prove a live session, model availability or inference.`,
        requiredModuleRoutes: [route],
        // Legacy publication metadata; authorization uses assigned modules.
        actionKeys: ['ai:manage'],
        effectKey: 'read:ai_settings',
        inputSchema: {
          sourceJson,
          definition: `${definition}Input`,
          sha256: sourceHash,
        },
        outputSchema: {
          sourceJson,
          definition: `${definition}Result`,
          sha256: sourceHash,
        },
        verifyAuthority: async (input, context) => {
          await currentActor(context.manager, {
            userId: context.actor.actorId,
            sessionId: context.actor.sessionId,
            transaction: context.manager,
          });
          for (const key of [
            'id_eq',
            'provider_id_eq',
            'api_key_id_eq',
            'actor_user_id_eq',
            'catalog_id_eq',
          ]) {
            const q = input.q;
            const id =
              q && typeof q === 'object' && !Array.isArray(q)
                ? q[key]
                : undefined;
            if (typeof id === 'string' && BigInt(id) > 9223372036854775807n)
              throw new Error('nodia_ai:invalid_tool_input');
          }
        },
        handler: (input, context) =>
          reads.execute(operation as AiSettingsOperation, input, context),
      }),
    ),
  };
}
