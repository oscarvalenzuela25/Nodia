import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
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
import { PrepareNodiaAiWorkflowUseCase } from '../../nodia-ai-proposal/use-case/prepare-nodia-ai-workflow.use-case.js';
import { GetNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/get-nodia-ai-proposal.use-case.js';
import {
  ValidateNodiaAiProposalUseCase,
  NODIA_AI_PROPOSAL_COMMON_SCHEMA,
} from '../../nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js';
import { NodiaAiDraft } from '../../nodia-ai-proposal/entities/nodia-ai-draft.entity.js';
import { NodiaAiToolCall } from '../../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import { NODIA_AI_WORKFLOW_CATALOG_VERSION } from '../../nodia-ai-proposal/types/workflow.types.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';

const invalid = (): never => {
  throw new BadRequestException('nodia_ai:invalid_tool_input');
};
const object = (v: NodiaAiJsonValue | undefined): NodiaAiJsonObject =>
  !v || typeof v !== 'object' || Array.isArray(v) ? invalid() : v;
const sha = (v: string) => createHash('sha256').update(v).digest('hex');
const PREFERENCE = 'nodia_preferences_prepare';
const WORKFLOW = 'nodia_workflows_prepare';
const ROUTE = '/nodia-ai';

/** Candidate-only helpers. No execution, confirmation, or acceptance of a preference. */
@Injectable()
export class BuildNodiaAiCommonPreparationToolsUseCase {
  constructor(
    private readonly prepare: PrepareNodiaAiProposalUseCase,
    private readonly workflow: PrepareNodiaAiWorkflowUseCase,
    private readonly proposals: GetNodiaAiProposalUseCase,
    private readonly validate: ValidateNodiaAiProposalUseCase,
    @Inject(NODIA_AI_PROPOSAL_COMMON_SCHEMA)
    private readonly commonSource: string,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  execute(): readonly NodiaAiToolFamily[] {
    const common = object(JSON.parse(this.commonSource) as NodiaAiJsonValue);
    const defs = object(common.$defs);
    const local = object(
      JSON.parse(
        readFileSync(
          new URL(
            '../../nodia-ai-products/contracts/common-preparation.json',
            import.meta.url,
          ),
          'utf8',
        ),
      ) as NodiaAiJsonValue,
    );
    const preferenceHashes = ['create', 'update', 'delete'].map((op) => {
      const p = this.validate.preparer(`${PREFERENCE}_${op}`);
      return {
        name: p.toolName,
        hash: p.contractHash,
        catalog: p.catalogVersion,
      };
    });
    const preparation = object(defs.PreparationResult);
    const definitions: NodiaAiJsonObject = {
      ...defs,
      ...object(local.$defs),
      McpWorkflowPrepareInput: {
        ...object(defs.WorkflowPrepareInput),
        $comment: `native_workflow:${NODIA_AI_WORKFLOW_CATALOG_VERSION}`,
        properties: {
          ...object(object(defs.WorkflowPrepareInput).properties),
          catalog_version: { const: NODIA_AI_WORKFLOW_CATALOG_VERSION },
        },
      },
      McpWorkflowPreparationResult: {
        ...preparation,
        properties: {
          ...object(preparation.properties),
          status: { const: 'ready' },
          draft_id: { type: 'null' },
          error: { type: 'null' },
        },
      },
      McpPreferencePreparationResult: {
        ...preparation,
        properties: {
          ...object(preparation.properties),
          status: { enum: ['ready', 'needs_clarification'] },
          draft_id: { $ref: '#/$defs/ProtocolId' },
          draft_revision: { type: 'integer', minimum: 1, maximum: 2147483647 },
          error: { type: 'null' },
        },
        required: [...(preparation.required as string[]), 'draft_revision'],
      },
    };
    definitions.McpPreferencePrepareInput = {
      ...object(definitions.McpPreferencePrepareInput),
      $comment: JSON.stringify({ native_preparers: preferenceHashes }),
    };
    const sourceJson = JSON.stringify({
      $schema: common.$schema,
      $id: local.$id,
      $defs: definitions,
    });
    const ref = (definition: string): NodiaAiToolSchemaReference => ({
      sourceJson,
      definition,
      sha256: sha(sourceJson),
    });
    const capabilities = [
      {
        name: WORKFLOW,
        kind: 'prepare_workflow' as const,
        input: 'McpWorkflowPrepareInput',
        output: 'McpWorkflowPreparationResult',
        description:
          'Prepara una propuesta secuencial desde borradores propios y enlaces tipados. No confirma ni ejecuta cambios.',
      },
      {
        name: PREFERENCE,
        kind: 'prepare_preference_change' as const,
        input: 'McpPreferencePrepareInput',
        output: 'McpPreferencePreparationResult',
        description:
          'Propone crear, actualizar o borrar una preferencia propia de las claves permitidas. La memoria sólo cambia tras confirmar con el botón humano.',
      },
    ].map((port) => {
      const inputSchema = ref(port.input),
        outputSchema = ref(port.output);
      const input = compileNodiaAiToolSchema(inputSchema),
        output = compileNodiaAiToolSchema(outputSchema);
      return {
        capabilityId: port.name,
        revision: 1,
        publication: 'published' as const,
        toolName: port.name,
        kind: port.kind,
        moduleKey: 'nodia_ai_common_preparation',
        resourceKey:
          port.name === WORKFLOW
            ? 'nodia_ai_workflows'
            : 'nodia_ai_preferences',
        operationKey: port.name,
        descriptionKey: 'nodia_ai:' + port.name,
        description: port.description,
        requiredModuleRoutes: [ROUTE],
        actionKeys: [],
        inputSchema,
        outputSchema,
        effectKey: 'prepare:' + port.name,
        verifyAuthority: async (
          _args: NodiaAiJsonObject,
          c: NodiaAiToolHandlerContext,
        ) => {
          this.context(c);
        },
        verifyResultAuthority: async (
          args: NodiaAiJsonObject,
          result: NodiaAiJsonObject,
          c: NodiaAiToolHandlerContext,
        ) => {
          this.context(c);
          if (!input.validate(args) || !output.validate(result))
            return invalid();
          await this.verify(port.name, args, result, c);
        },
        handler: async (
          args: NodiaAiJsonObject,
          c: NodiaAiToolHandlerContext,
        ) => {
          this.context(c);
          if (!input.validate(args) || !c.toolCallId) return invalid();
          const identity = {
            userId: c.actor.actorId,
            sessionId: c.actor.sessionId,
          };
          let result: NodiaAiJsonObject;
          if (port.name === WORKFLOW) {
            if (!c.runId || !c.attemptId) return invalid();
            result = await this.workflow.execute(
              c.manager,
              identity,
              c.conversationId!,
              args,
              {
                runId: c.runId,
                toolCallId: c.toolCallId,
                attemptId: c.attemptId,
              },
            );
          } else {
            const prepared = await this.prepare.execute(c.manager, identity, {
              conversationId: c.conversationId!,
              toolName: this.preferenceTool(args),
              partial: structuredClone(object(args.partial)),
              toolCallId: c.toolCallId,
              ...(args.draft_id !== undefined
                ? {
                    draftId: String(args.draft_id),
                    expectedDraftRevision: Number(args.expected_draft_revision),
                  }
                : {}),
            });
            const draft = await this.draft(
              String(prepared.draft_id),
              this.preferenceTool(args),
              c,
            );
            result = { ...prepared, draft_revision: draft.revision };
          }
          if (!output.validate(result)) return invalid();
          await this.verify(port.name, args, result, c);
          return result;
        },
      };
    });
    return [
      {
        familyKey: 'nodia_ai_common_preparation',
        modules: [
          {
            key: 'nodia_ai_common_preparation',
            route: ROUTE,
            label: 'NodiaAI',
          },
        ],
        resources: ['nodia_ai_workflows', 'nodia_ai_preferences'].map(
          (key) => ({ key, label: key, requiredModuleRoutes: [ROUTE] }),
        ),
        capabilities,
      },
    ];
  }
  private context(c: NodiaAiToolHandlerContext): void {
    if (
      !c.manager.queryRunner?.isTransactionActive ||
      !c.conversationId ||
      !c.moduleRoutes.includes(ROUTE) ||
      c.signal?.aborted
    )
      return invalid();
  }
  private preferenceTool(args: NodiaAiJsonObject) {
    if (!['create', 'update', 'delete'].includes(String(args.operation)))
      return invalid();
    return `${PREFERENCE}_${args.operation}`;
  }
  private async draft(id: string, tool: string, c: NodiaAiToolHandlerContext) {
    const d = await c.manager.getRepository(NodiaAiDraft).findOneBy({
      id,
      conversation_id: c.conversationId,
      actor_id: c.actor.actorId,
    });
    if (
      !d ||
      d.tool_name !== tool ||
      d.catalog_version !== this.validate.preparer(tool).catalogVersion
    )
      return invalid();
    return d;
  }
  private async verify(
    name: string,
    args: NodiaAiJsonObject,
    result: NodiaAiJsonObject,
    c: NodiaAiToolHandlerContext,
  ) {
    this.context(c);
    let historical = false;
    if (name === PREFERENCE) {
      const draft = await this.draft(
        String(result.draft_id),
        this.preferenceTool(args),
        c,
      );
      if (Number(result.draft_revision) > draft.revision) return invalid();
      historical = Number(result.draft_revision) < draft.revision;
      if (historical) {
        const receipt = c.toolCallId
          ? await c.manager.getRepository(NodiaAiToolCall).findOneBy({
              id: c.toolCallId,
              conversation_id: c.conversationId,
            })
          : null;
        if (
          !receipt ||
          receipt.tool_name !== name ||
          receipt.state !== 'completed' ||
          !this.validate.equal(receipt.public_result, result)
        )
          return invalid();
      }
      if (result.status === 'needs_clarification') {
        if (
          result.proposal !== null ||
          (!historical &&
            (draft.state !== 'incomplete' ||
              draft.claimed_proposal_id !== null ||
              !this.validate.equal(
                draft.clarifications.missing_fields,
                result.missing_fields,
              ) ||
              !this.validate.equal(
                draft.clarifications.clarification_keys,
                result.clarification_keys,
              )))
        )
          return invalid();
        if (
          !(result.missing_fields as NodiaAiJsonValue[]).length &&
          !(result.clarification_keys as NodiaAiJsonValue[]).length
        )
          return invalid();
        return;
      }
      if (
        !historical &&
        (draft.state !== 'ready' ||
          draft.claimed_proposal_id !== object(result.proposal).proposal_id)
      )
        return invalid();
    }
    if (
      result.status !== 'ready' ||
      (result.missing_fields as NodiaAiJsonValue[]).length ||
      (result.clarification_keys as NodiaAiJsonValue[]).length ||
      result.error !== null
    )
      return invalid();
    const publicProposal = object(result.proposal);
    const loaded = await this.proposals.load(
      c.manager,
      { userId: c.actor.actorId, sessionId: c.actor.sessionId },
      String(publicProposal.proposal_id),
      'read',
      Number(publicProposal.revision),
      c.conversationId,
    );
    if (
      loaded.proposal.conversation_id !== c.conversationId ||
      loaded.proposal.actor_id !== c.actor.actorId ||
      loaded.revision.hash !== publicProposal.hash ||
      (name === PREFERENCE &&
        (loaded.steps.length !== 1 ||
          loaded.steps[0].tool_name !== this.preferenceTool(args))) ||
      (name === WORKFLOW &&
        loaded.revision.catalog_version !== NODIA_AI_WORKFLOW_CATALOG_VERSION)
    )
      return invalid();
    if (name === WORKFLOW) {
      const draftIds = args.draft_ids as string[];
      if (loaded.steps.length !== draftIds.length) return invalid();
      for (const [index, id] of draftIds.entries()) {
        const draft = await c.manager.getRepository(NodiaAiDraft).findOneBy({
          id,
          conversation_id: c.conversationId,
          actor_id: c.actor.actorId,
        });
        if (
          !draft ||
          draft.state !== 'claimed' ||
          draft.claimed_proposal_id !== loaded.proposal.id ||
          draft.tool_name !== loaded.steps[index].tool_name ||
          draft.catalog_version !==
            this.validate.preparer(draft.tool_name).catalogVersion
        )
          return invalid();
      }
    }
    const projection = this.validate.compile(
      loaded.proposal,
      loaded.revision,
      loaded.steps,
    );
    projection.state = 'ready';
    projection.execution_id = null;
    if (!this.validate.equal(projection, publicProposal)) return invalid();
    if (
      (publicProposal.steps as NodiaAiJsonValue[]).length >
      this.policy.budget.steps_per_proposal
    )
      return invalid();
  }
}
