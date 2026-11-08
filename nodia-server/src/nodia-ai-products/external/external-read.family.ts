import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { currentActor } from '../../authorization/authority-transaction.js';
import type { NodiaAiToolFamily } from '../../nodia-ai-tools/types/tool-registry.types.js';
import {
  ReadNodiaAiExternalUseCase,
  type NodiaAiExternalReadPorts,
} from './use-case/read-external.use-case.js';

export const NODIA_AI_EXTERNAL_READ_FAMILY = Symbol(
  'NODIA_AI_EXTERNAL_READ_FAMILY',
);
export const NODIA_AI_EXTERNAL_READS = [
  ['nodia_ai_providers_health', 'health', 'EmptyInput', 'HealthResult'],
  [
    'nodia_ai_providers_gemini_engines',
    'engines',
    'EmptyInput',
    'EnginesResult',
  ],
  ['nodia_ai_providers_codex_session', 'codex', 'CodexInput', 'CodexResult'],
  ['nodia_ai_providers_models', 'models', 'ModelsInput', 'ModelsResult'],
  [
    'nodia_invoices_eligible_invoice_connections',
    'eligible',
    'EmptyInput',
    'EligibleResult',
  ],
] as const;

/** Candidate family; compiled publication bindings remain the only activation source. */
export function createNodiaAiExternalReadFamily(
  ports: NodiaAiExternalReadPorts,
  sourceJson = readFileSync(
    new URL('../contracts/external.schema.json', import.meta.url),
    'utf8',
  ),
): NodiaAiToolFamily {
  const reads = new ReadNodiaAiExternalUseCase(ports);
  const hash = createHash('sha256').update(sourceJson).digest('hex');
  return {
    familyKey: 'external_reads',
    modules: [
      {
        key: 'ai_providers',
        route: '/ai-providers',
        label: 'AI connection administration',
      },
      { key: 'businesses', route: '/business', label: 'Negocios' },
    ],
    resources: NODIA_AI_EXTERNAL_READS.map(([, operation]) => ({
      key: `external_${operation}`,
      label: `External ${operation}`,
      requiredModuleRoutes: [
        operation === 'eligible' ? '/business' : '/ai-providers',
      ],
    })),
    capabilities: NODIA_AI_EXTERNAL_READS.map(
      ([name, operation, input, output]) => ({
        capabilityId: name,
        revision: 1,
        publication: 'published',
        toolName: name,
        kind: 'read',
        moduleKey: operation === 'eligible' ? 'businesses' : 'ai_providers',
        resourceKey: `external_${operation}`,
        operationKey: 'observe',
        descriptionKey: name,
        description: `Observe ${operation} through the existing provider adapter outside SQL. Session, configuration and discovery do not prove inference. Unknown remains null; no automatic provider change.`,
        requiredModuleRoutes: [
          operation === 'eligible'
            ? '/business'
            : '/ai-providers',
        ],
        // Legacy publication metadata; authorization uses assigned modules.
        actionKeys: operation === 'eligible' ? [] : ['ai:manage'],
        effectKey: 'read:external_provider',
        inputSchema: { sourceJson, definition: input, sha256: hash },
        outputSchema: { sourceJson, definition: output, sha256: hash },
        verifyAuthority: async (_input, context) => {
          await currentActor(context.manager, {
            userId: context.actor.actorId,
            sessionId: context.actor.sessionId,
            transaction: context.manager,
          });
        },
        external: {
          prepare: (args, context) => reads.prepare(operation, args, context),
        },
        handler: async () => {
          throw new Error('nodia_ai:external_checkpoint_required');
        },
      }),
    ),
  };
}
