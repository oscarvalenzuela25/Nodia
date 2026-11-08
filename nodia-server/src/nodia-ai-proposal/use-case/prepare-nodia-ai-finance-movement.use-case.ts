import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { FinanceActor } from '../../authorization/authority-transaction.js';
import { CreateFinanceMovementDto } from '../../finance-movement/dto/create-finance-movement.dto.js';
import { FinanceLedgerService } from '../../finance-obligation/finance-ledger.service.js';
import {
  ensureRepaymentCapacity,
  repaymentType,
  requireActiveCategory,
  requireInitialMovement,
  requireOwned,
  validateMovementState,
} from '../../finance-obligation/use-case/finance-ledger.rules.js';
import {
  FINANCE_BIGINT_MAX,
  isFinanceBigint,
} from '../../finance-common/validation/finance-validation.js';
import type { NodiaAiProposalReviewField } from '../types/proposal-review.types.js';
import type { EntityManager } from 'typeorm';
import type {
  NodiaAiJsonObject,
  NodiaAiJsonValue,
} from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  NodiaAiProposalPreparer,
  ProposalFieldEdit,
  ProposalPreparation,
  ProposalPreparerContext,
  StoredProposalStep,
} from '../types/proposal-preparer.types.js';

const fields = {
  name: 'string',
  amount: 'finance_positive_bigint',
  type: 'finance_movement_type',
  status: 'finance_movement_status',
  category_id: 'finance_category_id',
  obligation_id: 'nullable_finance_obligation_id',
  is_active: 'boolean',
} as const;
const required = ['name', 'amount', 'type', 'status', 'category_id'] as const;
const route = '/finances-personal';
const contract = {
  version: 'nodia-ai-finance-movement-create/2',
  partial: { fields, owner_id: 'finance_positive_bigint', required: [] },
  command: {
    fields,
    required,
    defaults: { obligation_id: null, is_active: true },
  },
  presentation: {
    fields,
    origins: ['user', 'contract_default'],
    scope: ['subject_user_id'],
  },
  nativeValidation: 'CreateFinanceMovementDto+finance-ledger.rules/1',
  preconditions:
    'category_identity_name_key_activity_timestamp+obligation_ledger/2',
};
const invalid = (): never => {
  throw new BadRequestException('nodia_ai:invalid_input');
};
function object(value: NodiaAiJsonValue | undefined): NodiaAiJsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid();
  return value;
}
interface Decoded {
  ownerId: string;
  command: NodiaAiJsonObject;
  origins: NodiaAiJsonObject;
}

/** Internal preparation only. It never invokes a writer or registers an MCP capability. */
@Injectable()
export class PrepareNodiaAiFinanceMovementUseCase implements NodiaAiProposalPreparer {
  readonly toolName = 'nodia_finance_movements_prepare_create';
  readonly contractHash = createHash('sha256')
    .update(JSON.stringify(contract))
    .digest('hex');
  readonly catalogVersion = 'nodia-ai-ai19-finance-effect/1';
  readonly moduleRoutes = [route];
  readonly actionKeys: readonly string[] = [];
  readonly editableFields = fields;
  readonly bindableFields = {
    category_id: 'finance_category_id',
    obligation_id: 'finance_obligation_id',
  };
  readonly outputKeys = { id: 'finance_movement_id' };
  readonly reviewFields: readonly NodiaAiProposalReviewField[] = [
    {
      field_key: 'name',
      label_key: 'finance:name',
      kind: 'text',
      nullable: false,
      max_length: 255,
      minimum: null,
      maximum: null,
      options: [],
    },
    {
      field_key: 'amount',
      label_key: 'finance:amount',
      kind: 'bigint',
      nullable: false,
      max_length: null,
      minimum: '1',
      maximum: FINANCE_BIGINT_MAX.toString(),
      options: [],
    },
    {
      field_key: 'type',
      label_key: 'finance:type',
      kind: 'enum',
      nullable: false,
      max_length: null,
      minimum: null,
      maximum: null,
      options: ['income', 'expense'].map((value) => ({
        value,
        label_key: `finance:${value}`,
      })),
    },
    {
      field_key: 'status',
      label_key: 'finance:status',
      kind: 'enum',
      nullable: false,
      max_length: null,
      minimum: null,
      maximum: null,
      options: ['pending', 'received', 'paid', 'cancelled'].map((value) => ({
        value,
        label_key: `finance:${value}`,
      })),
    },
    {
      field_key: 'is_active',
      label_key: 'finance:active',
      kind: 'boolean',
      nullable: false,
      max_length: null,
      minimum: null,
      maximum: null,
      options: [],
    },
  ];

  constructor(private readonly ledger: FinanceLedgerService) {}

  private decode(
    partial: NodiaAiJsonObject,
    context: ProposalPreparerContext,
  ): Decoded {
    let ownerId: NodiaAiJsonValue | undefined;
    let command: NodiaAiJsonObject;
    let origins: NodiaAiJsonObject;
    if ('schema_version' in partial) {
      if (
        partial.schema_version !== 1 ||
        Object.keys(partial).some(
          (key) =>
            !['schema_version', 'owner_id', 'command', 'origins'].includes(key),
        )
      )
        return invalid();
      ownerId = partial.owner_id;
      command = { ...object(partial.command) };
      origins = { ...object(partial.origins) };
      if (
        Object.keys(origins).some(
          (key) => !Object.hasOwn(fields, key) || !Object.hasOwn(command, key),
        )
      )
        return invalid();
      for (const [key, origin] of Object.entries(origins)) {
        if (origin !== 'user' && origin !== 'contract_default')
          return invalid();
        if (
          origin === 'contract_default' &&
          !(
            (key === 'obligation_id' && command[key] === null) ||
            (key === 'is_active' && command[key] === true)
          )
        )
          return invalid();
      }
    } else {
      const { owner_id: owner, ...values } = partial;
      ownerId = owner === undefined ? context.actor.actorId : owner;
      command = values;
      origins = Object.fromEntries(
        Object.keys(command).map((key) => [key, 'user']),
      );
    }
    if (
      !isFinanceBigint(ownerId) ||
      Object.keys(command).some((key) => !Object.hasOwn(fields, key))
    )
      return invalid();
    const dto = plainToInstance(CreateFinanceMovementDto, command);
    if (
      validateSync(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
        skipUndefinedProperties: true,
      }).length
    )
      return invalid();
    // Use exactly the native DTO's transformations, retaining absence until complete.
    for (const key of Object.keys(command))
      command[key] = dto[
        key as keyof CreateFinanceMovementDto
      ] as NodiaAiJsonValue;
    return { ownerId, command, origins };
  }

  private actor(
    ownerId: string,
    context: ProposalPreparerContext,
  ): FinanceActor {
    if (!context.manager.queryRunner?.isTransactionActive)
      throw new ForbiddenException('authorization:transaction_required');
    if (!context.moduleRoutes.includes(route))
      throw new ForbiddenException('nodia_ai:capability_denied');
    return {
      userId: context.actor.actorId,
      sessionId: context.actor.sessionId,
      ownerId,
      transaction: context.manager,
      statementTimeoutMs: context.statementTimeoutMs,
    };
  }

  private template(decoded: Decoded): NodiaAiJsonObject {
    return {
      schema_version: 1,
      owner_id: decoded.ownerId,
      command: decoded.command,
      origins: decoded.origins,
    };
  }

  async prepare(
    partial: NodiaAiJsonObject,
    context: ProposalPreparerContext,
    previousPartial?: NodiaAiJsonObject,
  ): Promise<ProposalPreparation> {
    let decoded: Decoded;
    if (previousPartial === undefined) decoded = this.decode(partial, context);
    else {
      const previous = this.decode(previousPartial, context);
      // Only the trusted preparer merges its registered domain fields. Missing
      // recipient information preserves the draft's recipient, including SA.
      if (
        !Object.hasOwn(partial, 'schema_version') &&
        Object.hasOwn(partial, 'owner_id') &&
        partial.owner_id !== previous.ownerId
      )
        return invalid();
      const incoming = this.decode(
        Object.hasOwn(partial, 'schema_version')
          ? partial
          : { ...partial, owner_id: previous.ownerId },
        context,
      );
      if (incoming.ownerId !== previous.ownerId) return invalid();
      const command = { ...previous.command };
      const origins = { ...previous.origins };
      for (const field of Object.keys(fields)) {
        if (!Object.hasOwn(incoming.command, field)) continue;
        command[field] = incoming.command[field];
        origins[field] = incoming.origins[field] ?? 'user';
      }
      decoded = { ownerId: previous.ownerId, command, origins };
    }
    return this.ledger.withScope(
      this.actor(decoded.ownerId, context),
      async ({ manager, ownerId }) => {
        if (
          decoded.command.type !== undefined &&
          decoded.command.status !== undefined
        )
          validateMovementState(
            decoded.command.type as CreateFinanceMovementDto['type'],
            decoded.command.status as CreateFinanceMovementDto['status'],
          );
        const missingFields = required.filter(
          (key) => !Object.hasOwn(decoded.command, key),
        );
        if (missingFields.length)
          return {
            status: 'needs_clarification',
            partial: this.template(decoded),
            missingFields,
            clarificationKeys: missingFields.map(
              (key) => `nodia_ai:finance_movement_${key}_required`,
            ),
          };
        const dto = plainToInstance(CreateFinanceMovementDto, decoded.command);
        if (
          validateSync(dto, { whitelist: true, forbidNonWhitelisted: true })
            .length
        )
          return invalid();
        const preconditions = await this.snapshot(dto, manager, ownerId);
        if (!Object.hasOwn(decoded.command, 'obligation_id')) {
          decoded.command.obligation_id = null;
          decoded.origins.obligation_id = 'contract_default';
        }
        if (!Object.hasOwn(decoded.command, 'is_active')) {
          decoded.command.is_active = true;
          decoded.origins.is_active = 'contract_default';
        }
        const changes = Object.keys(fields).map((key) => ({
          field_key: key,
          before: null,
          before_present: false,
          after: decoded.command[key] ?? null,
          after_present: true,
          origin: decoded.origins[key] ?? 'user',
        }));
        const scope = { subject_user_id: ownerId };
        return {
          status: 'ready',
          commandTemplate: this.template(decoded),
          scope,
          preconditions,
          publicStep: {
            tool_name: this.toolName,
            kind: 'domain_change',
            target: null,
            scope,
            changes,
            depends_on: [],
            effect_key: 'finance_movement.create',
            output_bindings: [],
          },
        };
      },
    );
  }

  async applyEdits(
    template: NodiaAiJsonObject,
    edits: readonly ProposalFieldEdit[],
    context: ProposalPreparerContext,
  ): Promise<NodiaAiJsonObject> {
    const decoded = this.decode(template, context);
    const seen = new Set<string>();
    for (const edit of edits) {
      if (!Object.hasOwn(fields, edit.field_key) || seen.has(edit.field_key))
        return invalid();
      seen.add(edit.field_key);
      decoded.command[edit.field_key] = edit.value;
      decoded.origins[edit.field_key] = 'user';
    }
    const validated = this.decode(this.template(decoded), context);
    await this.ledger.withScope(
      this.actor(validated.ownerId, context),
      async () => undefined,
    );
    return this.template(validated);
  }

  async verifyAuthority(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<void> {
    const decoded = this.decode(step.commandTemplate, context);
    if (
      step.toolName !== this.toolName ||
      step.contractHash !== this.contractHash ||
      step.scope.subject_user_id !== decoded.ownerId
    )
      throw new ForbiddenException('nodia_ai:capability_denied');
    await this.ledger.withScope(
      this.actor(decoded.ownerId, context),
      async () => undefined,
    );
  }

  async verifyHistoricalReadAuthority(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<void> {
    const ownerId = step.scope.subject_user_id;
    if (
      step.toolName !== this.toolName ||
      Object.keys(step.scope).length !== 1 ||
      typeof ownerId !== 'string' ||
      !/^[1-9][0-9]{0,18}$/.test(ownerId) ||
      BigInt(ownerId) > 9223372036854775807n ||
      step.commandTemplate.schema_version !== 1 ||
      step.commandTemplate.owner_id !== ownerId ||
      Object.keys(step.commandTemplate).length !== 4 ||
      !['schema_version', 'owner_id', 'command', 'origins'].every((key) =>
        Object.hasOwn(step.commandTemplate, key),
      ) ||
      step.outputBindings.length !== 0 ||
      !Array.isArray(step.publicStep.depends_on) ||
      step.publicStep.depends_on.length !== 0
    )
      throw new ForbiddenException('nodia_ai:capability_denied');
    // Current session/owner/module authority; old business commands are never decoded or refreshed.
    await this.ledger.withScope(
      this.actor(ownerId, context),
      async () => undefined,
    );
  }

  async verifyPreconditions(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<void> {
    await this.verifyAuthority(step, context);
    const decoded = this.decode(step.commandTemplate, context);
    const dto = plainToInstance(CreateFinanceMovementDto, decoded.command);
    if (
      validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length
    )
      invalid();
    await this.ledger.withScope(
      this.actor(decoded.ownerId, context),
      async ({ manager, ownerId }) => {
        let current: NodiaAiJsonObject;
        try {
          current = await this.snapshot(dto, manager, ownerId);
        } catch (error) {
          if (
            error instanceof HttpException &&
            [400, 404, 409].includes(error.getStatus())
          )
            throw new ConflictException('nodia_ai:preconditions_changed');
          throw error;
        }
        if (!isDeepStrictEqual(current, step.preconditions))
          throw new ConflictException('nodia_ai:preconditions_changed');
      },
    );
  }

  /** Execution consumes the already reviewed command; normalization/defaults belong to preparation. */
  async resolveConfirmedCommand(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<{ dto: CreateFinanceMovementDto; ownerId: string }> {
    const template = step.commandTemplate;
    if (
      template.schema_version !== 1 ||
      Object.keys(template).length !== 4 ||
      Object.keys(step.scope).length !== 1 ||
      step.outputBindings.length !== 0 ||
      !Array.isArray(step.publicStep.depends_on) ||
      step.publicStep.depends_on.length !== 0
    )
      return invalid();
    const original = object(template.command);
    const origins = object(template.origins);
    if (
      Object.keys(original).length !== Object.keys(fields).length ||
      Object.keys(origins).length !== Object.keys(fields).length ||
      Object.keys(fields).some(
        (key) => !Object.hasOwn(original, key) || !Object.hasOwn(origins, key),
      )
    )
      return invalid();
    const decoded = this.decode(template, context);
    if (!isDeepStrictEqual(original, decoded.command)) return invalid();
    const dto = plainToInstance(CreateFinanceMovementDto, decoded.command);
    if (
      validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length
    )
      return invalid();
    await this.verifyPreconditions(step, context);
    return { dto, ownerId: decoded.ownerId };
  }

  private async snapshot(
    dto: CreateFinanceMovementDto,
    manager: EntityManager,
    ownerId: string,
  ): Promise<NodiaAiJsonObject> {
    validateMovementState(dto.type, dto.status);
    const preconditions: NodiaAiJsonObject = { schema_version: 1 };
    if (dto.obligation_id) {
      const obligation = requireOwned(
        await this.ledger.obligation(manager, ownerId, dto.obligation_id),
      );
      if (!obligation.is_active)
        throw new ConflictException('finance:inactive_obligation');
      if (dto.type !== repaymentType(obligation))
        throw new BadRequestException('finance:invalid_repayment_direction');
      const initial = requireInitialMovement(
        await this.ledger.initialMovements(manager, obligation),
      );
      if (initial.status === 'cancelled')
        throw new ConflictException('finance:cancelled_obligation');
      const paid = await this.ledger.confirmedPaid(manager, obligation);
      ensureRepaymentCapacity(obligation, paid, dto);
      preconditions.obligation = {
        id: obligation.id,
        user_id: ownerId,
        type: obligation.type,
        amount: obligation.amount,
        is_active: obligation.is_active,
        updated_at: obligation.updated_at.toISOString(),
        initial_movement_id: initial.id,
        initial_status: initial.status,
        confirmed_paid: paid,
      };
    }
    const category = requireActiveCategory(
      await this.ledger.category(manager, ownerId, dto.category_id),
    );
    preconditions.category = {
      id: category.id,
      user_id: ownerId,
      name: category.name,
      key: category.key,
      is_active: category.is_active,
      updated_at: category.updated_at.toISOString(),
    };
    return preconditions;
  }
}
