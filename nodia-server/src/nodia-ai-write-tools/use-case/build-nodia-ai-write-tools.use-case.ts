import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type {
  NodiaAiJsonObject,
  NodiaAiJsonValue,
} from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  NodiaAiToolFamily,
  NodiaAiToolHandlerContext,
  NodiaAiToolSchemaReference,
} from '../../nodia-ai-tools/types/tool-registry.types.js';
import { compileNodiaAiToolSchema } from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import { PrepareNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case.js';
import { GetNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/get-nodia-ai-proposal.use-case.js';
import {
  ValidateNodiaAiProposalUseCase,
  NODIA_AI_PROPOSAL_COMMON_SCHEMA,
} from '../../nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js';
import { NodiaAiDraft } from '../../nodia-ai-proposal/entities/nodia-ai-draft.entity.js';
import { NodiaAiToolCall } from '../../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { nodiaAiSecureOperationIdentity } from '../../nodia-ai-proposal/types/secure-operation.types.js';
import { DecodeNodiaAiWriteJsonUseCase } from './decode-nodia-ai-write-json.use-case.js';
import {
  loadNodiaAiWriteContracts,
  type WriteContractBundle,
  type WriteToolContract,
} from '../types/write-tool-contract.types.js';

const invalid = (): never => {
  throw new BadRequestException('nodia_ai:invalid_tool_input');
};
const object = (value: NodiaAiJsonValue | undefined): NodiaAiJsonObject => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid();
  return value;
};
const sha = (source: string) =>
  createHash('sha256').update(source).digest('hex');
function scopedDefinitions(value: NodiaAiJsonValue): NodiaAiJsonValue {
  if (Array.isArray(value)) return value.map(scopedDefinitions);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        key === '$ref' &&
        typeof item === 'string' &&
        item.startsWith('#/$defs/')
          ? '#/$defs/WritePartial_' + item.slice('#/$defs/'.length)
          : scopedDefinitions(item),
      ]),
    );
  return value;
}

/** Candidate adapters only. Building these exports neither approves knowledge nor publishes a tool. */
@Injectable()
export class BuildNodiaAiWriteToolsUseCase {
  constructor(
    private readonly prepare: PrepareNodiaAiProposalUseCase,
    private readonly proposals: GetNodiaAiProposalUseCase,
    private readonly validate: ValidateNodiaAiProposalUseCase,
    @Inject(NODIA_AI_PROPOSAL_COMMON_SCHEMA)
    private readonly commonSource: string,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}

  execute(
    bundles: readonly WriteContractBundle[] = loadNodiaAiWriteContracts(),
  ): readonly NodiaAiToolFamily[] {
    const seen = new Set<string>();
    return bundles.map((bundle) => {
      if (typeof bundle.schema.$id !== 'string')
        throw Error('nodia_ai:write_contract_invalid');
      const common = object(JSON.parse(this.commonSource) as NodiaAiJsonValue);
      const commonDefs = object(common.$defs);
      const partialDefs = object(bundle.schema.$defs);
      const definitions: NodiaAiJsonObject = { ...commonDefs };
      for (const [name, value] of Object.entries(partialDefs))
        definitions['WritePartial_' + name] = scopedDefinitions(value);
      const preparation = object(commonDefs.PreparationResult);
      definitions.McpWritePreparationResult = {
        ...preparation,
        properties: {
          ...object(preparation.properties),
          status: { enum: ['ready', 'needs_clarification'] },
          draft_id: { $ref: '#/$defs/ProtocolId' },
          draft_revision: { type: 'integer', minimum: 1, maximum: 2147483647 },
          error: { type: 'null' },
        },
        required: [...(preparation.required as string[]), 'draft_revision'],
      };
      const ports = bundle.tools.map((tool) => {
        if (
          seen.has(tool.tool_name) ||
          !Object.hasOwn(partialDefs, tool.input_definition)
        )
          throw Error('nodia_ai:write_contract_invalid');
        seen.add(tool.tool_name);
        const preparer = this.validate.preparer(tool.tool_name);
        const secureIdentity = nodiaAiSecureOperationIdentity(tool.tool_name);
        const humanChannel =
          secureIdentity !== null &&
          [
            'api_key_create',
            'api_key_update',
            'connection_login',
            'nodia_logout',
          ].includes(secureIdentity.kind);
        if (
          (tool.kind === 'prepare_secure_flow') !== humanChannel ||
          (tool.kind !== undefined && tool.kind !== 'prepare_secure_flow') ||
          (humanChannel &&
            (!('kind' in preparer) ||
              preparer.kind !== secureIdentity!.kind ||
              tool.json_fields?.length)) ||
          (!preparer.moduleRoutes.length &&
            secureIdentity?.kind !== 'nodia_logout')
        )
          throw Error('nodia_ai:write_contract_invalid');
        const name = 'McpWriteInput_' + tool.input_definition;
        definitions[name] = {
          type: 'object',
          additionalProperties: false,
          $comment: `native_preparer:${preparer.contractHash};catalog:${preparer.catalogVersion}`,
          properties: {
            partial: { $ref: '#/$defs/WritePartial_' + tool.input_definition },
            draft_id: { $ref: '#/$defs/ProtocolId' },
            expected_draft_revision: {
              type: 'integer',
              minimum: 1,
              maximum: 2147483647,
            },
          },
          required: ['partial'],
          dependentRequired: {
            draft_id: ['expected_draft_revision'],
            expected_draft_revision: ['draft_id'],
          },
        };
        return {
          tool,
          preparer,
          name,
          registrationRoutes: preparer.moduleRoutes.length
            ? preparer.moduleRoutes
            : ['/tools/nodia-ai'],
        };
      });
      const sourceJson = JSON.stringify({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: bundle.schema.$id + '/mcp',
        $defs: definitions,
      });
      const reference = (definition: string): NodiaAiToolSchemaReference => ({
        sourceJson,
        definition,
        sha256: sha(sourceJson),
      });
      const modules = [
        ...new Set(
          ports.flatMap(({ registrationRoutes }) => [...registrationRoutes]),
        ),
      ].map((route) => ({
        key:
          'write_' +
          route.split('/').filter(Boolean).join('_').replaceAll('-', '_'),
        route,
        label: route,
      }));
      const resources = [
        ...new Set(ports.map(({ tool }) => tool.resource_key)),
      ].map((key) => ({
        key,
        label: key,
        requiredModuleRoutes: [
          ...new Set(
            ports
              .filter(({ tool }) => tool.resource_key === key)
              .flatMap(({ registrationRoutes }) => [...registrationRoutes]),
          ),
        ],
      }));
      return {
        familyKey: 'nodia_write_' + sha(bundle.schema.$id).slice(0, 12),
        modules,
        resources,
        capabilities: ports.map(
          ({ tool, preparer, name, registrationRoutes }) => {
            const inputSchema = reference(name),
              outputSchema = reference('McpWritePreparationResult');
            const input = compileNodiaAiToolSchema(inputSchema),
              output = compileNodiaAiToolSchema(outputSchema);
            return {
              capabilityId: tool.tool_name,
              revision: 1,
              publication: 'published' as const,
              toolName: tool.tool_name,
              kind: tool.kind ?? ('prepare_change' as const),
              moduleKey: modules.find(
                (module) => module.route === registrationRoutes[0],
              )!.key,
              resourceKey: tool.resource_key,
              operationKey: tool.tool_name,
              descriptionKey: 'nodia_ai:' + tool.tool_name,
              description: tool.description,
              requiredModuleRoutes: [...registrationRoutes],
              actionKeys: [...preparer.actionKeys],
              inputSchema,
              outputSchema,
              effectKey: 'prepare:' + tool.tool_name,
              verifyAuthority: async (
                _partial: NodiaAiJsonObject,
                context: NodiaAiToolHandlerContext,
              ) => {
                this.assertContext(context, preparer.moduleRoutes);
              },
              verifyResultAuthority: async (
                _partial: NodiaAiJsonObject,
                result: NodiaAiJsonObject,
                context: NodiaAiToolHandlerContext,
              ) => {
                if (!output.validate(result)) return invalid();
                await this.verifyResult(tool, result, context);
              },
              handler: async (
                argumentsValue: NodiaAiJsonObject,
                context: NodiaAiToolHandlerContext,
              ) => {
                this.assertContext(context, preparer.moduleRoutes);
                if (!input.validate(argumentsValue)) return invalid();
                const partial = structuredClone(object(argumentsValue.partial));
                for (const key of tool.json_fields ?? [])
                  if (Object.hasOwn(partial, key))
                    partial[key] = new DecodeNodiaAiWriteJsonUseCase().execute(
                      partial[key],
                      this.policy.results.json_collection_items,
                    );
                const prepared = await this.prepare.execute(
                  context.manager,
                  {
                    userId: context.actor.actorId,
                    sessionId: context.actor.sessionId,
                  },
                  {
                    conversationId: context.conversationId!,
                    toolName: tool.tool_name,
                    partial,
                    ...(context.toolCallId
                      ? { toolCallId: context.toolCallId }
                      : {}),
                    ...(argumentsValue.draft_id !== undefined
                      ? {
                          draftId: String(argumentsValue.draft_id),
                          expectedDraftRevision: Number(
                            argumentsValue.expected_draft_revision,
                          ),
                        }
                      : {}),
                  },
                );
                const draft = await this.draft(
                  tool,
                  String(prepared.draft_id),
                  context,
                );
                const result = { ...prepared, draft_revision: draft.revision };
                if (!output.validate(result)) return invalid();
                await this.verifyResult(tool, result, context);
                return result;
              },
            };
          },
        ),
      };
    });
  }
  private assertContext(
    context: NodiaAiToolHandlerContext,
    routes: readonly string[],
  ): void {
    if (
      !context.manager.queryRunner?.isTransactionActive ||
      !context.conversationId ||
      !routes.every((route) => context.moduleRoutes.includes(route)) ||
      context.signal?.aborted
    )
      return invalid();
  }
  private async draft(
    tool: WriteToolContract,
    id: string,
    context: NodiaAiToolHandlerContext,
  ) {
    const draft = await context.manager.getRepository(NodiaAiDraft).findOneBy({
      id,
      conversation_id: context.conversationId,
      actor_id: context.actor.actorId,
    });
    if (
      !draft ||
      draft.tool_name !== tool.tool_name ||
      draft.catalog_version !==
        this.validate.preparer(tool.tool_name).catalogVersion
    )
      throw new NotFoundException('nodia_ai:draft_not_found');
    return draft;
  }
  private async verifyResult(
    tool: WriteToolContract,
    result: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ) {
    this.assertContext(
      context,
      this.validate.preparer(tool.tool_name).moduleRoutes,
    );
    const draft = await this.draft(tool, String(result.draft_id), context);
    if (
      !Number.isSafeInteger(result.draft_revision) ||
      Number(result.draft_revision) > draft.revision
    )
      return invalid();
    const historical = Number(result.draft_revision) < draft.revision;
    if (historical) {
      if (!context.toolCallId) return invalid();
      const receipt = await context.manager
        .getRepository(NodiaAiToolCall)
        .findOneBy({
          id: context.toolCallId,
          conversation_id: context.conversationId,
        });
      if (
        !receipt ||
        receipt.tool_name !== tool.tool_name ||
        receipt.state !== 'completed' ||
        !receipt.public_result ||
        !this.validate.equal(receipt.public_result, result)
      )
        return invalid();
    }
    if (result.status === 'ready') {
      const proposal = object(result.proposal);
      if (
        proposal.state !== 'ready' ||
        !Array.isArray(result.missing_fields) ||
        result.missing_fields.length ||
        !Array.isArray(result.clarification_keys) ||
        result.clarification_keys.length ||
        (!historical &&
          (draft.state !== 'ready' ||
            draft.claimed_proposal_id !== proposal.proposal_id))
      )
        return invalid();
      const loaded = await this.proposals.load(
        context.manager,
        { userId: context.actor.actorId, sessionId: context.actor.sessionId },
        String(proposal.proposal_id),
        'read',
        Number(proposal.revision),
      );
      if (
        loaded.proposal.conversation_id !== context.conversationId ||
        loaded.proposal.actor_id !== context.actor.actorId ||
        loaded.revision.hash !== proposal.hash ||
        loaded.steps.length !== 1 ||
        loaded.steps[0].tool_name !== tool.tool_name
      )
        return invalid();
      // Lifecycle state can advance after this immutable preparation receipt was issued.
      // Compare all immutable public values, never just the caller-supplied hash string.
      const projection = this.validate.compile(
        loaded.proposal,
        loaded.revision,
        loaded.steps,
      );
      projection.state = 'ready';
      projection.execution_id = null;
      if (!this.validate.equal(projection, proposal)) return invalid();
    } else if (
      result.status !== 'needs_clarification' ||
      result.proposal !== null ||
      result.error !== null ||
      !Array.isArray(result.missing_fields) ||
      !Array.isArray(result.clarification_keys) ||
      result.missing_fields.length + result.clarification_keys.length === 0 ||
      (!historical &&
        (draft.state !== 'incomplete' || draft.claimed_proposal_id !== null))
    )
      return invalid();
    if (
      !historical &&
      result.status === 'needs_clarification' &&
      (!this.validate.equal(
        draft.clarifications.missing_fields,
        result.missing_fields,
      ) ||
        !this.validate.equal(
          draft.clarifications.clarification_keys,
          result.clarification_keys,
        ))
    )
      return invalid();
  }
}
