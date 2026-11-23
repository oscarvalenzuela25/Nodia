import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { moduleRouteIncluded } from '../authorization/canonical-module-route.js';
import type {
  NodiaAiJsonObject,
  NodiaAiJsonValue,
} from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  ProposalFieldEdit,
  ProposalPreparation,
  ProposalPreparerContext,
  StoredProposalStep,
} from '../nodia-ai-proposal/types/proposal-preparer.types.js';
import { isNodiaAiDomainUuid } from '../nodia-ai-proposal/types/local-operation.types.js';
import type {
  NodiaAiToolHandlerContext,
  NodiaAiToolSchemaReference,
} from '../nodia-ai-tools/types/tool-registry.types.js';
import { compileNodiaAiToolSchema } from '../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import {
  TEACHER_MODULE_ROUTE,
  type NodiaAiTeacherOperation,
  type TeacherOperationContext,
  type TeacherPreparedCommand,
  type TeacherWriteCandidate,
} from './types.js';
import { nodiaAiTeacherOperationIdentity } from './teacher-operation-identity.js';

function object(value: unknown): value is NodiaAiJsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function teacherOperationContext(
  context: NodiaAiToolHandlerContext,
): TeacherOperationContext {
  if (
    !context.manager.queryRunner?.isTransactionActive ||
    !moduleRouteIncluded(context.moduleRoutes, TEACHER_MODULE_ROUTE) ||
    context.signal?.aborted
  )
    throw new ForbiddenException('nodia_ai:capability_denied');
  return {
    actorId: context.actor.actorId,
    sessionId: context.actor.sessionId,
    manager: context.manager,
    statementTimeoutMs: context.statementTimeoutMs,
  };
}

function reviewValue(value: NodiaAiJsonValue): NodiaAiJsonValue {
  // The proposal protocol bounds JSON depth. Keep exact nested plans and batches
  // visible as text without adding another structural layer for each field.
  return value !== null && typeof value === 'object'
    ? JSON.stringify(value)
    : value;
}

export class TeacherProposalOperation implements NodiaAiTeacherOperation {
  readonly catalogVersion = 'nodia-ai-teacher-study/1';
  readonly moduleRoutes = [TEACHER_MODULE_ROUTE];
  readonly actionKeys = [];
  readonly editableFields = {};
  readonly bindableFields = {};
  readonly outputKeys = {};
  readonly toolName: string;
  readonly contractHash: string;
  private readonly validate;
  private readonly identity;

  constructor(
    private readonly candidate: TeacherWriteCandidate,
    schema: NodiaAiToolSchemaReference,
  ) {
    this.toolName = candidate.toolName;
    const identity = nodiaAiTeacherOperationIdentity(candidate.toolName);
    if (!identity) throw new Error('nodia_ai:invalid_teacher_contract');
    this.identity = identity;
    this.validate = compileNodiaAiToolSchema(schema).validate;
    this.contractHash = createHash('sha256')
      .update(
        JSON.stringify([
          this.catalogVersion,
          candidate.toolName,
          schema.definition,
          schema.sha256,
        ]),
      )
      .digest('hex');
  }

  async prepare(
    input: NodiaAiJsonObject,
    context: ProposalPreparerContext,
  ): Promise<ProposalPreparation> {
    const actor = teacherOperationContext(context);
    if (!this.validate(input))
      throw new BadRequestException('nodia_ai:invalid_tool_input');
    const prepared = await this.candidate.prepare(input, actor);
    const commandTemplate: NodiaAiJsonObject = {
      schema_version: 1,
      command: prepared.command,
      title: prepared.title,
      ...(prepared.id === undefined ? {} : { id: prepared.id }),
    };
    this.decode(commandTemplate, prepared.preconditions);
    const scope = { subject_user_id: actor.actorId };
    const { resourceKey, operation } = this.identity;
    return {
      status: 'ready',
      commandTemplate,
      scope,
      preconditions: prepared.preconditions,
      publicStep: {
        tool_name: this.toolName,
        kind: 'domain_change',
        target: prepared.id
          ? {
              resource_key: resourceKey,
              id: prepared.id,
              label: prepared.title,
            }
          : null,
        scope,
        effect_key: `${resourceKey}.${operation}`,
        changes: Object.entries(prepared.preview ?? prepared.command).map(
          ([field_key, value]) => ({
            field_key,
            before: null,
            before_present: false,
            after: reviewValue(value),
            after_present: true,
            origin: 'user',
          }),
        ),
        depends_on: [],
        output_bindings: [],
      },
    };
  }

  async applyEdits(
    template: NodiaAiJsonObject,
    edits: readonly ProposalFieldEdit[],
  ) {
    if (edits.length)
      throw new BadRequestException('nodia_ai:invalid_proposal');
    return template;
  }

  async verifyAuthority(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ) {
    const actor = teacherOperationContext(context);
    if (
      step.toolName !== this.toolName ||
      step.contractHash !== this.contractHash ||
      Object.keys(step.scope).length !== 1 ||
      step.scope.subject_user_id !== actor.actorId ||
      step.outputBindings.length
    )
      throw new ForbiddenException('nodia_ai:capability_denied');
    this.decode(step.commandTemplate, step.preconditions);
  }

  async verifyPreconditions(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ) {
    await this.verifyAuthority(step, context);
    try {
      await this.candidate.verify(
        this.decode(step.commandTemplate, step.preconditions),
        {
          ...teacherOperationContext(context),
          requestKey: context.executionStepId,
        },
      );
    } catch (error) {
      if (
        error instanceof HttpException &&
        [404, 409].includes(error.getStatus())
      )
        throw new ConflictException('nodia_ai:preconditions_changed');
      throw error;
    }
  }

  async executeConfirmed(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ) {
    if (!isNodiaAiDomainUuid(context.executionStepId))
      throw new InternalServerErrorException(
        'nodia_ai:invalid_persisted_state',
      );
    await this.verifyPreconditions(step, context);
    const command = this.decode(step.commandTemplate, step.preconditions);
    const actor = teacherOperationContext(context);
    const result = await this.candidate.execute(command, {
      ...actor,
      requestKey: context.executionStepId,
    });
    if (
      !isNodiaAiDomainUuid(result.id) ||
      (command.id !== undefined && result.id !== command.id)
    )
      throw new InternalServerErrorException(
        'nodia_ai:invalid_persisted_state',
      );
    return { id: result.id, ownerId: actor.actorId };
  }

  private decode(
    template: NodiaAiJsonObject,
    preconditions: NodiaAiJsonObject,
  ): TeacherPreparedCommand {
    const { id, command, title, schema_version, ...extra } = template;
    if (
      schema_version !== 1 ||
      Object.keys(extra).length ||
      !object(command) ||
      !object(preconditions) ||
      typeof title !== 'string' ||
      !title.trim() ||
      (id !== undefined && !isNodiaAiDomainUuid(id)) ||
      (this.identity.operation !== 'create' && id === undefined)
    )
      throw new InternalServerErrorException(
        'nodia_ai:invalid_persisted_state',
      );
    return { id, command, title, preconditions };
  }
}
