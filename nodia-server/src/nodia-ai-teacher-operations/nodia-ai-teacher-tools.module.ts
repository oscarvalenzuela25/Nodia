import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Module,
  type DynamicModule,
} from '@nestjs/common';
import type { NodiaAiJsonObject } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { NodiaAiDraft } from '../nodia-ai-proposal/entities/nodia-ai-draft.entity.js';
import { NodiaAiProposalModule } from '../nodia-ai-proposal/nodia-ai-proposal.module.js';
import { isNodiaAiDomainUuid } from '../nodia-ai-proposal/types/local-operation.types.js';
import { GetNodiaAiProposalUseCase } from '../nodia-ai-proposal/use-case/get-nodia-ai-proposal.use-case.js';
import { PrepareNodiaAiProposalUseCase } from '../nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case.js';
import { ValidateNodiaAiProposalUseCase } from '../nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js';
import { selectPublishedNodiaAiFamilies } from '../nodia-ai-products/nodia-ai-product-reads.module.js';
import type {
  NodiaAiToolFamily,
  NodiaAiToolHandlerContext,
  NodiaAiToolRegistration,
} from '../nodia-ai-tools/types/tool-registry.types.js';
import {
  loadTeacherProposalSchemaSource,
  loadTeacherToolContracts,
  loadTeacherToolSchemaSource,
  teacherSchemaReference,
} from './teacher-contracts.js';
import { NodiaAiTeacherOperationsModule } from './nodia-ai-teacher-operations.module.js';
import { teacherOperationContext } from './teacher-proposal-operation.js';
import {
  NODIA_AI_TEACHER_READS,
  TEACHER_MODULE_ROUTE,
  type TeacherReadCandidate,
} from './types.js';

export const NODIA_AI_CANDIDATE_TEACHER_FAMILIES = Symbol(
  'NODIA_AI_CANDIDATE_TEACHER_FAMILIES',
);
const moduleKey = 'nodia_teacher';
const moduleRoutes = [TEACHER_MODULE_ROUTE];

function invalidResult(): never {
  throw new InternalServerErrorException('nodia_ai:invalid_persisted_state');
}

@Injectable()
export class BuildNodiaAiTeacherTools {
  constructor(
    @Inject(NODIA_AI_TEACHER_READS)
    private readonly readers: readonly TeacherReadCandidate[],
    private readonly prepare: PrepareNodiaAiProposalUseCase,
    private readonly proposals: GetNodiaAiProposalUseCase,
    private readonly validate: ValidateNodiaAiProposalUseCase,
  ) {}

  execute(ids: readonly string[]): readonly NodiaAiToolFamily[] {
    const contracts = loadTeacherToolContracts();
    const schema = loadTeacherToolSchemaSource();
    const proposalSchema = loadTeacherProposalSchemaSource();
    const readers = new Map(
      this.readers.map((reader) => [reader.toolName, reader]),
    );
    if (readers.size !== this.readers.length)
      throw new Error('nodia_ai:invalid_teacher_contract');
    const capabilities = ids.map((id): NodiaAiToolRegistration => {
      const contract = contracts.get(id);
      if (!contract) throw new Error('nodia_ai:invalid_teacher_contract');
      const { toolName, kind, resourceKey, operationKey, description } =
        contract;
      const read = kind === 'read';
      const reader = read ? readers.get(toolName) : undefined;
      if (read) {
        if (!reader) throw new Error('nodia_ai:invalid_teacher_contract');
      } else {
        this.validate.preparer(toolName);
      }
      return {
        capabilityId: toolName,
        revision: 1,
        publication: 'published',
        toolName,
        kind,
        moduleKey,
        resourceKey,
        operationKey,
        description,
        descriptionKey: 'nodia_ai:' + toolName,
        requiredModuleRoutes: moduleRoutes,
        actionKeys: [],
        inputSchema: teacherSchemaReference(schema, contract.inputSchema),
        outputSchema: teacherSchemaReference(
          read ? schema : proposalSchema,
          contract.outputSchema,
        ),
        effectKey: `${read ? 'read' : 'prepare'}:${toolName}`,
        verifyAuthority: async (_input, context) => {
          teacherOperationContext(context);
        },
        handler: (input, context) =>
          reader
            ? reader.execute(input, teacherOperationContext(context))
            : this.prepareChange(toolName, input, context),
        verifyResultAuthority: (input, result, context) =>
          reader
            ? this.verifyReadReplay(reader, input, result, context)
            : this.verifyPreparation(toolName, result, context),
      };
    });
    return selectPublishedNodiaAiFamilies(
      [
        {
          familyKey: moduleKey,
          modules: [
            {
              key: moduleKey,
              route: TEACHER_MODULE_ROUTE,
              label: 'Nodia Teacher',
            },
          ],
          resources: [
            ...new Set(capabilities.map(({ resourceKey }) => resourceKey)),
          ].map((key) => ({
            key,
            label: key,
            requiredModuleRoutes: moduleRoutes,
          })),
          capabilities,
        },
      ],
      ids,
    );
  }

  private prepareChange(
    toolName: string,
    input: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ) {
    const actor = teacherOperationContext(context);
    if (!context.conversationId || !context.toolCallId) return invalidResult();
    return this.prepare.execute(
      context.manager,
      { userId: actor.actorId, sessionId: actor.sessionId },
      {
        conversationId: context.conversationId,
        toolName,
        partial: input,
        toolCallId: context.toolCallId,
      },
    );
  }

  private async verifyReadReplay(
    reader: TeacherReadCandidate,
    input: NodiaAiJsonObject,
    result: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ) {
    // The gateway supplies a call ID for a previously persisted read.
    if (!context.toolCallId) return;
    const current = await reader.execute(
      input,
      teacherOperationContext(context),
    );
    if (!this.validate.equal(current, result))
      throw new ConflictException('nodia_ai:preconditions_changed');
  }

  private async verifyPreparation(
    toolName: string,
    result: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ) {
    const actor = teacherOperationContext(context);
    const proposal = result.proposal as NodiaAiJsonObject | null;
    if (
      result.status !== 'ready' ||
      !context.conversationId ||
      !context.toolCallId ||
      !isNodiaAiDomainUuid(result.draft_id) ||
      !proposal ||
      !isNodiaAiDomainUuid(proposal.proposal_id) ||
      typeof proposal.revision !== 'number'
    )
      return invalidResult();
    const draft = await context.manager.getRepository(NodiaAiDraft).findOneBy({
      id: result.draft_id,
      conversation_id: context.conversationId,
      actor_id: actor.actorId,
      tool_call_id: context.toolCallId,
    });
    if (
      !draft ||
      draft.tool_name !== toolName ||
      draft.claimed_proposal_id !== proposal.proposal_id
    )
      return invalidResult();
    const loaded = await this.proposals.load(
      context.manager,
      { userId: actor.actorId, sessionId: actor.sessionId },
      proposal.proposal_id,
      'read',
      proposal.revision,
      context.conversationId,
    );
    if (
      loaded.proposal.actor_id !== actor.actorId ||
      loaded.steps.length !== 1 ||
      loaded.steps[0].tool_name !== toolName ||
      loaded.revision.hash !== proposal.hash
    )
      return invalidResult();
    const frozen = { ...loaded.projection, state: 'ready', execution_id: null };
    if (!this.validate.equal(frozen, proposal)) return invalidResult();
  }
}

@Module({})
export class NodiaAiTeacherToolsModule {
  static forPublication(ids: readonly string[]): DynamicModule {
    return {
      module: NodiaAiTeacherToolsModule,
      imports: ids.length
        ? [NodiaAiTeacherOperationsModule, NodiaAiProposalModule]
        : [],
      providers: ids.length
        ? [
            BuildNodiaAiTeacherTools,
            {
              provide: NODIA_AI_CANDIDATE_TEACHER_FAMILIES,
              inject: [BuildNodiaAiTeacherTools],
              useFactory: (builder: BuildNodiaAiTeacherTools) =>
                builder.execute(ids),
            },
          ]
        : [{ provide: NODIA_AI_CANDIDATE_TEACHER_FAMILIES, useValue: [] }],
      exports: [NODIA_AI_CANDIDATE_TEACHER_FAMILIES],
    };
  }
}
