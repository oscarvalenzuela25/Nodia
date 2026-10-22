import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { readFileSync } from 'node:fs';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  NodiaAiToolFamily,
  NodiaAiToolHandlerContext,
  NodiaAiToolSchemaReference,
} from '../../nodia-ai-tools/types/tool-registry.types.js';
import { compileNodiaAiToolSchema } from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import { GetNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/get-nodia-ai-proposal.use-case.js';
import { GetNodiaAiExecutionUseCase } from '../../nodia-ai-confirmation/use-case/get-nodia-ai-execution.use-case.js';
import { ManageNodiaAiAttachmentUseCase } from '../../nodia-ai-attachment/use-case/manage-nodia-ai-attachment.use-case.js';
import { ListNodiaAiPreferencesUseCase } from '../../nodia-ai-preference/use-case/list-nodia-ai-preferences.use-case.js';
import { NODIA_AI_COMMON_READ_TOOLS } from '../types/common-read-tools.types.js';

const invalid = (output = false): never => {
  throw output
    ? new InternalServerErrorException('nodia_ai:invalid_tool_output')
    : new BadRequestException('nodia_ai:invalid_tool_input');
};
const object = (value: unknown): NodiaAiJsonObject => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid(true);
  return value as NodiaAiJsonObject;
};

/** Candidate native reads only. Publication selection and current authority remain mandatory. */
@Injectable()
export class BuildNodiaAiCommonReadToolsUseCase {
  constructor(
    private readonly proposals: GetNodiaAiProposalUseCase,
    private readonly operations: GetNodiaAiExecutionUseCase,
    private readonly attachments: ManageNodiaAiAttachmentUseCase,
    private readonly preferences: ListNodiaAiPreferencesUseCase,
  ) {}
  execute(): readonly NodiaAiToolFamily[] {
    const sourceJson = readFileSync(
      new URL(
        '../../nodia-ai-products/contracts/common-reads.json',
        import.meta.url,
      ),
      'utf8',
    );
    const sha256 = createHash('sha256').update(sourceJson).digest('hex');
    const schema = (definition: string): NodiaAiToolSchemaReference => ({
      sourceJson,
      definition,
      sha256,
    });
    const definitions = [
      [
        'ProposalGetInput',
        'PublicProposal',
        'nodia_ai_proposals',
        'Consulta una propuesta de esta conversación con su revisión pública exacta; no confirma cambios.',
      ],
      [
        'OperationGetInput',
        'ExecutionStatus',
        'nodia_ai_operations',
        'Consulta el estado nativo de una operación de esta conversación; no la reanuda ni ejecuta.',
      ],
      [
        'AttachmentDescribeInput',
        'AttachmentMetadata',
        'nodia_ai_attachments',
        'Consulta sólo metadatos seguros de un adjunto de esta conversación; no descarga ni interpreta su contenido.',
      ],
      [
        'PreferenceListInput',
        'PreferencePage',
        'nodia_ai_preferences',
        'Lista exclusivamente tus preferencias aceptadas con su disponibilidad actual; no las modifica.',
      ],
    ];
    return [
      {
        familyKey: 'nodia_ai_common_reads',
        modules: [
          {
            key: 'nodia_ai_common',
            route: '/tools/nodia-ai',
            label: 'NodiaAI',
          },
        ],
        resources: definitions.map((row) => ({
          key: row[2],
          label: row[2],
          requiredModuleRoutes: ['/tools/nodia-ai'],
        })),
        capabilities: NODIA_AI_COMMON_READ_TOOLS.map((name, index) => {
          const [inputDef, outputDef, resource, description] =
            definitions[index];
          const inputSchema = schema(inputDef),
            outputSchema = schema(outputDef),
            inputValidator = compileNodiaAiToolSchema(inputSchema).validate,
            outputValidator = compileNodiaAiToolSchema(outputSchema).validate;
          const check = (
            input: NodiaAiJsonObject,
            context: NodiaAiToolHandlerContext,
          ) => {
            if (!inputValidator(input)) invalid();
            if (
              !context.manager.queryRunner?.isTransactionActive ||
              !context.conversationId
            )
              throw new InternalServerErrorException(
                'authorization:transaction_required',
              );
            context.signal?.throwIfAborted();
          };
          const read = async (
            input: NodiaAiJsonObject,
            context: NodiaAiToolHandlerContext,
            revision?: number,
          ): Promise<NodiaAiJsonObject> => {
            check(input, context);
            const identity = {
              userId: context.actor.actorId,
              sessionId: context.actor.sessionId,
            };
            switch (name) {
              case 'nodia_proposals_get':
                return this.proposals.executeInTransaction(
                  context.manager,
                  identity,
                  String(input.proposal_id),
                  revision,
                  context.conversationId,
                );
              case 'nodia_operations_get':
                return object(
                  await this.operations.load(
                    context.manager,
                    identity,
                    String(input.execution_id),
                    context.conversationId,
                  ),
                );
              case 'nodia_attachments_describe': {
                const row = await this.attachments.getInTransaction(
                  context.manager,
                  identity,
                  String(input.attachment_id),
                  context.conversationId,
                );
                return {
                  attachment_id: row.attachment_id,
                  kind: row.kind,
                  state: row.state,
                  media_type: row.media_type,
                  byte_count: row.byte_count,
                  page_count: row.page_count,
                  duration_seconds: row.duration_seconds,
                };
              }
              case 'nodia_preferences_list':
                return object(
                  await this.preferences.executeInTransaction(
                    context.manager,
                    identity,
                    input,
                  ),
                );
            }
          };
          return {
            capabilityId: name,
            revision: 1,
            publication: 'published' as const,
            toolName: name,
            kind: 'read' as const,
            moduleKey: 'nodia_ai_common',
            resourceKey: resource,
            operationKey: name === 'nodia_preferences_list' ? 'list' : 'get',
            descriptionKey: `nodia_ai:tools.${name}`,
            description,
            requiredModuleRoutes: ['/tools/nodia-ai'],
            actionKeys: [],
            inputSchema,
            outputSchema,
            effectKey: `${resource}.read`,
            verifyAuthority: async (input, context) => {
              check(input, context);
            },
            verifyResultAuthority: async (input, result, context) => {
              if (!outputValidator(result)) invalid(true);
              if (name === 'nodia_proposals_get') {
                if (
                  result.proposal_id !== input.proposal_id ||
                  typeof result.revision !== 'number'
                )
                  return invalid(true);
                const current = await read(input, context, result.revision);
                if (
                  result.execution_id !== null &&
                  result.execution_id !== current.execution_id
                )
                  return invalid(true);
                for (const key of [
                  'proposal_id',
                  'revision',
                  'hash',
                  'catalog_version',
                  'steps',
                  'created_at',
                  'expires_at',
                ]) {
                  if (!isDeepStrictEqual(result[key], current[key]))
                    return invalid(true);
                }
              } else if (name === 'nodia_operations_get') {
                if (result.execution_id !== input.execution_id)
                  return invalid(true);
                const current = await read(input, context);
                const oldSteps = result.steps,
                  currentSteps = current.steps;
                if (
                  !Array.isArray(oldSteps) ||
                  !Array.isArray(currentSteps) ||
                  oldSteps.length !== currentSteps.length ||
                  typeof result.revision !== 'number' ||
                  typeof current.revision !== 'number' ||
                  result.revision > current.revision
                )
                  return invalid(true);
                for (const [index, entry] of oldSteps.entries()) {
                  const prior = object(entry),
                    present = object(currentSteps[index]);
                  if (
                    prior.step_id !== present.step_id ||
                    !Array.isArray(prior.result_refs) ||
                    !Array.isArray(present.result_refs)
                  )
                    return invalid(true);
                  const currentReferences = present.result_refs;
                  if (
                    prior.result_refs.some(
                      (reference) =>
                        !currentReferences.some((actual) =>
                          isDeepStrictEqual(reference, actual),
                        ),
                    )
                  )
                    return invalid(true);
                }
              } else if (name === 'nodia_attachments_describe') {
                if (result.attachment_id !== input.attachment_id) invalid(true);
                await read(input, context);
              } else {
                // Stored snapshots must not reveal a preference whose own value changed or disappeared.
                const current = await read(
                  {
                    ...(input.scope_key ? { scope_key: input.scope_key } : {}),
                    page_limit: 50,
                  },
                  context,
                );
                const rows = current.items,
                  items = result.items;
                if (!Array.isArray(rows) || !Array.isArray(items))
                  return invalid(true);
                for (const item of items) {
                  const prior = object(item),
                    row = rows
                      .map(object)
                      .find(
                        (value) => value.preference_id === prior.preference_id,
                      );
                  if (
                    !row ||
                    [
                      'scope_key',
                      'key',
                      'value',
                      'revision',
                      'available',
                      'value_label',
                      'scope_label',
                    ].some((key) => row[key] !== prior[key]) ||
                    JSON.stringify(row.scope) !== JSON.stringify(prior.scope)
                  )
                    throw new NotFoundException(
                      'nodia_ai:preference_not_found',
                    );
                }
              }
            },
            handler: async (input, context) => {
              const result = await read(input, context);
              if (!outputValidator(result)) invalid(true);
              return result;
            },
          };
        }),
      },
    ];
  }
}
