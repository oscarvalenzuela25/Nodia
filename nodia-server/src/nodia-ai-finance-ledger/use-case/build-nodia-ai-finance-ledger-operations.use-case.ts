import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { EntityManager } from 'typeorm';
import type { FinanceActor } from '../../authorization/authority-transaction.js';
import type { FinanceCategory } from '../../finance-category/entities/finance-category.entity.js';
import {
  FINANCE_BIGINT_MAX,
  isFinanceBigint,
} from '../../finance-common/validation/finance-validation.js';
import { UpdateFinanceMovementDto } from '../../finance-movement/dto/update-finance-movement.dto.js';
import type { FinanceMovement } from '../../finance-movement/entities/finance-movement.entity.js';
import { UpdateFinanceMovementUseCase } from '../../finance-movement/use-case/update-finance-movement.use-case.js';
import { DeleteFinanceMovementUseCase } from '../../finance-movement/use-case/delete-finance-movement.use-case.js';
import { resolveFinanceMovementUpdate } from '../../finance-movement/use-case/resolve-finance-movement-update.js';
import { CreateFinanceObligationDto } from '../../finance-obligation/dto/create-finance-obligation.dto.js';
import { UpdateFinanceObligationDto } from '../../finance-obligation/dto/update-finance-obligation.dto.js';
import type { FinanceObligation } from '../../finance-obligation/entities/finance-obligation.entity.js';
import { FinanceLedgerService } from '../../finance-obligation/finance-ledger.service.js';
import { CreateFinanceObligationUseCase } from '../../finance-obligation/use-case/create-finance-obligation.use-case.js';
import { UpdateFinanceObligationUseCase } from '../../finance-obligation/use-case/update-finance-obligation.use-case.js';
import { DeleteFinanceObligationUseCase } from '../../finance-obligation/use-case/delete-finance-obligation.use-case.js';
import {
  isConfirmed,
  repaymentType,
  requireActiveCategory,
  requireDeletableMovement,
  requireInitialMovement,
  requireNoRepayments,
  requireOwned,
  validateObligationPrincipal,
} from '../../finance-obligation/use-case/finance-ledger.rules.js';
import type {
  NodiaAiJsonObject,
  NodiaAiJsonValue,
} from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiFinanceOperation } from '../../nodia-ai-finance-effect/types/financial-operation.types.js';
import type {
  ProposalFieldEdit,
  ProposalPreparation,
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import type { NodiaAiProposalReviewField } from '../../nodia-ai-proposal/types/proposal-review.types.js';

const route = '/finances-personal';
const movementFields = {
  name: 'string',
  amount: 'finance_positive_bigint',
  type: 'finance_movement_type',
  status: 'finance_movement_status',
  category_id: 'finance_category_id',
  is_active: 'boolean',
} as const;
const obligationCreateFields = {
  name: 'string',
  key: 'string',
  type: 'finance_obligation_type',
  amount: 'finance_positive_bigint',
  category_id: 'finance_category_id',
  description: 'nullable_string',
  is_active: 'boolean',
} as const;
const obligationUpdateFields = {
  name: 'string',
  key: 'string',
  amount: 'finance_positive_bigint',
  description: 'nullable_string',
  is_active: 'boolean',
} as const;
type LedgerDto =
  | UpdateFinanceMovementDto
  | CreateFinanceObligationDto
  | UpdateFinanceObligationDto;
type LedgerDefinition = {
  resource: 'finance_movements' | 'finance_obligations';
  operation: 'create' | 'update' | 'delete';
  fields: Readonly<Record<string, string>>;
  required: readonly string[];
  dto?: new () => LedgerDto;
};
interface Decoded {
  ownerId: string;
  id?: string;
  command: NodiaAiJsonObject;
  origins: NodiaAiJsonObject;
}
interface Snapshot {
  frozen: NodiaAiJsonObject;
  target: FinanceMovement | FinanceObligation | null;
  next?: FinanceMovement;
  obligation?: FinanceObligation;
  initial?: FinanceMovement;
  paid?: string;
}
const invalid = (): never => {
  throw new BadRequestException('nodia_ai:invalid_input');
};
function object(value: NodiaAiJsonValue | undefined): NodiaAiJsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid();
  return value;
}
function movementSnapshot(row: FinanceMovement): NodiaAiJsonObject {
  return {
    id: row.id,
    user_id: row.user_id,
    category_id: row.category_id,
    obligation_id: row.obligation_id,
    name: row.name,
    amount: row.amount,
    type: row.type,
    status: row.status,
    is_active: row.is_active,
    updated_at: row.updated_at.toISOString(),
  };
}
function obligationSnapshot(row: FinanceObligation): NodiaAiJsonObject {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    key: row.key,
    amount: row.amount,
    type: row.type,
    description: row.description,
    is_active: row.is_active,
    updated_at: row.updated_at.toISOString(),
  };
}
function categorySnapshot(row: FinanceCategory): NodiaAiJsonObject {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    key: row.key,
    is_active: row.is_active,
    updated_at: row.updated_at.toISOString(),
  };
}
/** Structured presentation follows ReviewValue; raw domain JSON is never a public ReviewObject. */
function reviewValue(value: NodiaAiJsonValue): NodiaAiJsonValue {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value))
    return { kind: 'array', items: value.map(reviewValue) };
  return {
    kind: 'object',
    fields: Object.entries(value).map(([field_key, item]) => ({
      field_key,
      value: reviewValue(item),
    })),
  };
}
function reviewFields(
  fields: Readonly<Record<string, string>>,
): NodiaAiProposalReviewField[] {
  return Object.keys(fields)
    .filter((key) => key !== 'category_id')
    .map((key) => ({
      field_key: key,
      label_key: `finance:${key === 'is_active' ? 'active' : key}`,
      kind:
        key === 'amount'
          ? 'bigint'
          : key === 'is_active'
            ? 'boolean'
            : key === 'type' || key === 'status'
              ? 'enum'
              : 'text',
      nullable: key === 'description',
      max_length:
        key === 'description'
          ? 5000
          : ['name', 'key'].includes(key)
            ? 255
            : null,
      minimum: key === 'amount' ? '1' : null,
      maximum: key === 'amount' ? FINANCE_BIGINT_MAX.toString() : null,
      options: (key === 'type'
        ? fields.type === 'finance_obligation_type'
          ? ['loan', 'debt']
          : ['income', 'expense']
        : key === 'status'
          ? ['pending', 'received', 'paid', 'cancelled']
          : []
      ).map((value) => ({ value, label_key: `finance:${value}` })),
    }));
}

/** Trusted local operation adapter. Domain rules and writes remain in the native ledger. */
class FinanceLedgerOperation implements NodiaAiFinanceOperation {
  readonly toolName: string;
  readonly contractHash: string;
  readonly catalogVersion = 'nodia-ai-ai21-finance/1';
  readonly moduleRoutes = [route];
  readonly actionKeys: readonly string[] = [];
  readonly editableFields: Readonly<Record<string, string>>;
  readonly bindableFields: Readonly<Record<string, string>> = {};
  readonly outputKeys: Readonly<Record<string, string>>;
  readonly reviewFields: readonly NodiaAiProposalReviewField[];
  readonly resourceKey: 'finance_movements' | 'finance_obligations';
  readonly operation: 'create' | 'update' | 'delete';
  constructor(
    private readonly definition: LedgerDefinition,
    private readonly ledger: FinanceLedgerService,
    private readonly write: (
      actor: FinanceActor,
      decoded: Decoded,
    ) => Promise<string>,
  ) {
    this.resourceKey = definition.resource;
    this.operation = definition.operation;
    this.toolName = `nodia_${definition.resource}_prepare_${definition.operation}`;
    this.editableFields = definition.fields;
    this.outputKeys = {
      id:
        definition.resource === 'finance_movements'
          ? 'finance_movement_id'
          : 'finance_obligation_id',
    };
    this.reviewFields = reviewFields(definition.fields);
    this.contractHash = createHash('sha256')
      .update(
        JSON.stringify({
          version: `${this.toolName}/1`,
          fields: definition.fields,
          required: definition.required,
          target_required: definition.operation !== 'create',
          nonempty_update: definition.operation === 'update',
          defaults:
            definition.operation === 'create'
              ? { description: null, is_active: true }
              : {},
          native_validation: 'finance-ledger-native/ai21-v1',
          preconditions:
            'material-target-category-obligation-initial-paid-count/1',
          presentation: 'submitted-fields-plus-native-ledger-effects/1',
          origins: ['user', 'contract_default'],
        }),
      )
      .digest('hex');
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
      ...(decoded.id === undefined ? {} : { id: decoded.id }),
      command: decoded.command,
      origins: decoded.origins,
    };
  }
  private decode(
    input: NodiaAiJsonObject,
    context: ProposalPreparerContext,
  ): Decoded {
    let ownerId: NodiaAiJsonValue | undefined,
      id: NodiaAiJsonValue | undefined,
      command: NodiaAiJsonObject,
      origins: NodiaAiJsonObject;
    if (Object.hasOwn(input, 'schema_version')) {
      if (
        input.schema_version !== 1 ||
        Object.keys(input).some(
          (key) =>
            ![
              'schema_version',
              'owner_id',
              'id',
              'command',
              'origins',
            ].includes(key),
        )
      )
        return invalid();
      ownerId = input.owner_id;
      id = input.id;
      command = { ...object(input.command) };
      origins = { ...object(input.origins) };
      if (
        Object.keys(origins).length !== Object.keys(command).length ||
        Object.keys(command).some((key) => !Object.hasOwn(origins, key))
      )
        return invalid();
      for (const [key, origin] of Object.entries(origins)) {
        if (origin !== 'user' && origin !== 'contract_default')
          return invalid();
        if (
          origin === 'contract_default' &&
          !(
            this.operation === 'create' &&
            ((key === 'description' && command[key] === null) ||
              (key === 'is_active' && command[key] === true))
          )
        )
          return invalid();
      }
    } else {
      const { owner_id, id: targetId, ...values } = input;
      ownerId = owner_id === undefined ? context.actor.actorId : owner_id;
      id = targetId;
      command = values;
      origins = Object.fromEntries(
        Object.keys(command).map((key) => [key, 'user']),
      );
    }
    if (
      !isFinanceBigint(ownerId) ||
      Object.values(command).some((value) => value === undefined) ||
      (id !== undefined && !isFinanceBigint(id)) ||
      (this.operation === 'create' && id !== undefined) ||
      Object.keys(command).some(
        (key) => !Object.hasOwn(this.definition.fields, key),
      )
    )
      return invalid();
    if (this.definition.dto) {
      const dto = plainToInstance(this.definition.dto, command);
      if (
        validateSync(dto, {
          whitelist: true,
          forbidNonWhitelisted: true,
          skipUndefinedProperties: true,
        }).length
      )
        return invalid();
      for (const key of Object.keys(command))
        command[key] = (dto as unknown as Record<string, NodiaAiJsonValue>)[
          key
        ];
    }
    return { ownerId, ...(id === undefined ? {} : { id }), command, origins };
  }
  async prepare(
    partial: NodiaAiJsonObject,
    context: ProposalPreparerContext,
    previousPartial?: NodiaAiJsonObject,
  ): Promise<ProposalPreparation> {
    let decoded = this.decode(partial, context);
    if (previousPartial !== undefined) {
      const previous = this.decode(previousPartial, context);
      decoded = this.decode(
        Object.hasOwn(partial, 'schema_version')
          ? partial
          : {
              ...partial,
              owner_id: partial.owner_id ?? previous.ownerId,
              ...(partial.id === undefined && previous.id !== undefined
                ? { id: previous.id }
                : {}),
            },
        context,
      );
      if (
        decoded.ownerId !== previous.ownerId ||
        (previous.id !== undefined && decoded.id !== previous.id)
      )
        return invalid();
      decoded = {
        ...decoded,
        command: { ...previous.command, ...decoded.command },
        origins: { ...previous.origins, ...decoded.origins },
      };
    }
    return this.ledger.withScope(
      this.actor(decoded.ownerId, context),
      async ({ manager, ownerId }) => {
        const missingFields = [
          ...(this.operation !== 'create' && decoded.id === undefined
            ? ['id']
            : []),
          ...this.definition.required.filter(
            (key) => !Object.hasOwn(decoded.command, key),
          ),
          ...(this.operation === 'update' &&
          Object.keys(decoded.command).length === 0
            ? ['changes']
            : []),
        ];
        if (missingFields.length)
          return {
            status: 'needs_clarification',
            partial: this.template(decoded),
            missingFields,
            clarificationKeys: missingFields.map(
              (key) => `nodia_ai:${this.resourceKey}_${key}_required`,
            ),
          };
        if (this.operation === 'create') {
          if (!Object.hasOwn(decoded.command, 'description')) {
            decoded.command.description = null;
            decoded.origins.description = 'contract_default';
          }
          if (!Object.hasOwn(decoded.command, 'is_active')) {
            decoded.command.is_active = true;
            decoded.origins.is_active = 'contract_default';
          }
        }
        const snapshot = await this.snapshot(decoded, manager, ownerId);
        const before =
          snapshot.target === null
            ? null
            : this.resourceKey === 'finance_movements'
              ? movementSnapshot(snapshot.target as FinanceMovement)
              : obligationSnapshot(snapshot.target as FinanceObligation);
        const changes: NodiaAiJsonObject[] =
          this.operation === 'delete'
            ? Object.entries(before!).map(([key, value]) => ({
                field_key: key,
                before: value,
                before_present: true,
                after: null,
                after_present: false,
                origin: 'user',
              }))
            : Object.entries(decoded.command).map(([key, value]) => ({
                field_key: key,
                before: before?.[key] ?? null,
                before_present: before !== null && Object.hasOwn(before, key),
                after: value,
                after_present: true,
                origin: decoded.origins[key],
              }));
        this.addDerivedChanges(changes, decoded, snapshot);
        const scope = { subject_user_id: ownerId };
        return {
          status: 'ready',
          commandTemplate: this.template(decoded),
          scope,
          preconditions: snapshot.frozen,
          publicStep: {
            tool_name: this.toolName,
            kind: 'domain_change',
            target:
              decoded.id === undefined
                ? null
                : { resource_key: this.resourceKey, id: decoded.id },
            scope,
            changes,
            depends_on: [],
            effect_key: `${this.resourceKey === 'finance_movements' ? 'finance_movement' : 'finance_obligation'}.${this.operation}`,
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
    const decoded = this.decode(template, context),
      seen = new Set<string>();
    for (const edit of edits) {
      if (
        !Object.hasOwn(this.editableFields, edit.field_key) ||
        seen.has(edit.field_key)
      )
        return invalid();
      seen.add(edit.field_key);
      decoded.command[edit.field_key] = edit.value;
      decoded.origins[edit.field_key] = 'user';
    }
    const checked = this.decode(this.template(decoded), context);
    await this.ledger.withScope(
      this.actor(checked.ownerId, context),
      async () => undefined,
    );
    return this.template(checked);
  }
  async verifyAuthority(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<void> {
    const decoded = this.decode(step.commandTemplate, context);
    if (
      step.toolName !== this.toolName ||
      step.contractHash !== this.contractHash ||
      Object.keys(step.scope).length !== 1 ||
      step.scope.subject_user_id !== decoded.ownerId
    )
      throw new ForbiddenException('nodia_ai:capability_denied');
    await this.ledger.withScope(
      this.actor(decoded.ownerId, context),
      async () => undefined,
    );
  }
  async verifyPreconditions(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<void> {
    await this.verifyAuthority(step, context);
    const decoded = this.decode(step.commandTemplate, context);
    await this.ledger.withScope(
      this.actor(decoded.ownerId, context),
      async ({ manager, ownerId }) => {
        let current: Snapshot;
        try {
          current = await this.snapshot(decoded, manager, ownerId);
        } catch (error) {
          if (
            error instanceof HttpException &&
            [400, 404, 409].includes(error.getStatus())
          )
            throw new ConflictException('nodia_ai:preconditions_changed');
          throw error;
        }
        if (!isDeepStrictEqual(current.frozen, step.preconditions))
          throw new ConflictException('nodia_ai:preconditions_changed');
      },
    );
  }
  async executeConfirmed(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<{ id: string; ownerId: string }> {
    const decoded = this.decode(step.commandTemplate, context);
    if (
      !isDeepStrictEqual(step.commandTemplate, this.template(decoded)) ||
      step.outputBindings.length !== 0 ||
      !Array.isArray(step.publicStep.depends_on) ||
      step.publicStep.depends_on.length !== 0 ||
      (this.operation !== 'create' && decoded.id === undefined) ||
      (this.operation === 'update' &&
        Object.keys(decoded.command).length === 0) ||
      this.definition.required.some(
        (key) => !Object.hasOwn(decoded.command, key),
      )
    )
      return invalid();
    if (
      this.definition.dto &&
      validateSync(plainToInstance(this.definition.dto, decoded.command), {
        whitelist: true,
        forbidNonWhitelisted: true,
      }).length
    )
      return invalid();
    if (
      this.operation === 'create' &&
      (!Object.hasOwn(decoded.command, 'description') ||
        !Object.hasOwn(decoded.command, 'is_active'))
    )
      return invalid();
    await this.verifyPreconditions(step, context);
    const id = await this.write(this.actor(decoded.ownerId, context), decoded);
    if (!isFinanceBigint(id))
      throw new InternalServerErrorException('nodia_ai:invalid_output');
    return { id, ownerId: decoded.ownerId };
  }
  private async snapshot(
    decoded: Decoded,
    manager: EntityManager,
    ownerId: string,
  ): Promise<Snapshot> {
    const frozen: NodiaAiJsonObject = { schema_version: 1 };
    if (
      this.resourceKey === 'finance_obligations' &&
      decoded.command.key !== undefined
    ) {
      const duplicates = await manager.query<Array<{ id: string }>>(
        'SELECT id::text AS id FROM finance_obligations WHERE user_id=$1 AND key=$2 AND ($3::bigint IS NULL OR id<>$3::bigint) LIMIT 1',
        [ownerId, decoded.command.key, decoded.id ?? null],
      );
      if (duplicates.length)
        throw new ConflictException('finance:duplicate_key');
      frozen.key_available = true;
    }
    if (this.operation === 'create') {
      const category = requireActiveCategory(
        await this.ledger.category(
          manager,
          ownerId,
          decoded.command.category_id as string,
        ),
      );
      frozen.category = categorySnapshot(category);
      return { frozen, target: null };
    }
    if (decoded.id === undefined) return invalid();
    let target: FinanceMovement | FinanceObligation,
      obligation: FinanceObligation | null,
      next: FinanceMovement | undefined;
    if (this.resourceKey === 'finance_movements') {
      if (this.operation === 'update') {
        const plan = await resolveFinanceMovementUpdate(
          this.ledger,
          manager,
          ownerId,
          decoded.id,
          plainToInstance(UpdateFinanceMovementDto, decoded.command),
        );
        target = plan.movement;
        obligation = plan.obligation;
        next = plan.next;
      } else {
        const identity = requireOwned(
          await this.ledger.movement(manager, ownerId, decoded.id, false),
        );
        obligation = identity.obligation_id
          ? requireOwned(
              await this.ledger.obligation(
                manager,
                ownerId,
                identity.obligation_id,
              ),
            )
          : null;
        target = requireOwned(
          await this.ledger.movement(manager, ownerId, decoded.id),
        );
        requireDeletableMovement(target, obligation);
      }
      frozen.target = movementSnapshot(target);
      const category = requireOwned(
        await this.ledger.category(
          manager,
          ownerId,
          next?.category_id ?? target.category_id,
        ),
      );
      frozen.category = categorySnapshot(category);
    } else {
      target = requireOwned(
        await this.ledger.obligation(manager, ownerId, decoded.id),
      );
      obligation = target;
      frozen.target = obligationSnapshot(target);
    }
    if (!obligation) return { frozen, target, next };
    const initial = requireInitialMovement(
      await this.ledger.initialMovements(manager, obligation),
    );
    const paid = await this.ledger.confirmedPaid(manager, obligation);
    const rows = await manager.query<Array<{ count: string }>>(
      'SELECT COUNT(*)::text AS count FROM finance_movements WHERE user_id=$1 AND obligation_id=$2 AND type=$3',
      [ownerId, obligation.id, repaymentType(obligation)],
    );
    if (rows.length !== 1 || !/^(0|[1-9]\d*)$/.test(rows[0].count))
      throw new InternalServerErrorException('nodia_ai:invalid_output');
    if (this.resourceKey === 'finance_obligations') {
      if (this.operation === 'delete')
        requireNoRepayments(rows[0].count !== '0');
      else
        validateObligationPrincipal(
          decoded.command.amount as string | undefined,
          paid,
        );
    }
    frozen.obligation = obligationSnapshot(obligation);
    frozen.initial_movement = movementSnapshot(initial);
    frozen.confirmed_paid = paid;
    frozen.repayment_count = rows[0].count;
    return { frozen, target, next, obligation, initial, paid };
  }
  private addDerivedChanges(
    changes: NodiaAiJsonObject[],
    decoded: Decoded,
    snapshot: Snapshot,
  ): void {
    const derived = (
      key: string,
      before: NodiaAiJsonValue,
      after: NodiaAiJsonValue,
      beforePresent = true,
      afterPresent = true,
    ) =>
      changes.push({
        field_key: key,
        before: reviewValue(before),
        before_present: beforePresent,
        after: reviewValue(after),
        after_present: afterPresent,
        origin: 'contract_default',
      });
    if (
      this.resourceKey === 'finance_obligations' &&
      this.operation === 'create'
    ) {
      derived(
        'initial_movement',
        null,
        {
          name: decoded.command.name,
          amount: decoded.command.amount,
          type: decoded.command.type === 'loan' ? 'expense' : 'income',
          status: decoded.command.type === 'loan' ? 'paid' : 'received',
          category_id: decoded.command.category_id,
          is_active: decoded.command.is_active,
        },
        false,
      );
      derived('paid_amount', null, '0', false);
      derived('remaining_amount', null, decoded.command.amount, false);
    } else if (
      snapshot.obligation &&
      snapshot.initial &&
      snapshot.paid !== undefined
    ) {
      const { obligation, initial, paid } = snapshot;
      const beforeRemaining =
        initial.status === 'cancelled'
          ? null
          : (BigInt(obligation.amount) - BigInt(paid)).toString();
      if (this.resourceKey === 'finance_obligations') {
        if (this.operation === 'delete') {
          derived(
            'initial_movement',
            movementSnapshot(initial),
            null,
            true,
            false,
          );
          derived('paid_amount', paid, null, true, false);
          derived('remaining_amount', beforeRemaining, null, true, false);
        } else {
          if (
            decoded.command.amount !== undefined &&
            decoded.command.amount !== obligation.amount
          )
            derived(
              'initial_movement.amount',
              initial.amount,
              decoded.command.amount,
            );
          derived('paid_amount', paid, paid);
          derived(
            'remaining_amount',
            beforeRemaining,
            initial.status === 'cancelled'
              ? null
              : (
                  BigInt(
                    (decoded.command.amount ?? obligation.amount) as string,
                  ) - BigInt(paid)
                ).toString(),
          );
        }
      } else {
        const movement = snapshot.target as FinanceMovement;
        const next = this.operation === 'delete' ? null : snapshot.next!;
        const isRepayment = movement.type === repaymentType(obligation);
        const afterPaid = (
          BigInt(paid) -
          (isRepayment && isConfirmed(movement)
            ? BigInt(movement.amount)
            : 0n) +
          (isRepayment && next && isConfirmed(next) ? BigInt(next.amount) : 0n)
        ).toString();
        const cancelledInitial =
          movement.id === initial.id && next?.status === 'cancelled';
        derived('paid_amount', paid, afterPaid);
        derived(
          'remaining_amount',
          beforeRemaining,
          initial.status === 'cancelled' || cancelledInitial
            ? null
            : (BigInt(obligation.amount) - BigInt(afterPaid)).toString(),
        );
      }
    }
  }
}

@Injectable()
export class BuildNodiaAiFinanceLedgerOperationsUseCase {
  readonly operations: readonly NodiaAiFinanceOperation[];
  constructor(
    ledger: FinanceLedgerService,
    updateMovement: UpdateFinanceMovementUseCase,
    deleteMovement: DeleteFinanceMovementUseCase,
    createObligation: CreateFinanceObligationUseCase,
    updateObligation: UpdateFinanceObligationUseCase,
    deleteObligation: DeleteFinanceObligationUseCase,
  ) {
    this.operations = Object.freeze([
      new FinanceLedgerOperation(
        {
          resource: 'finance_movements',
          operation: 'update',
          fields: movementFields,
          required: [],
          dto: UpdateFinanceMovementDto,
        },
        ledger,
        async (actor, decoded) => {
          const result = await updateMovement.execute(
            actor,
            decoded.id!,
            plainToInstance(UpdateFinanceMovementDto, decoded.command),
          );
          if (result.user_id !== decoded.ownerId)
            throw new InternalServerErrorException('nodia_ai:invalid_output');
          return result.id;
        },
      ),
      new FinanceLedgerOperation(
        {
          resource: 'finance_movements',
          operation: 'delete',
          fields: {},
          required: [],
        },
        ledger,
        async (actor, decoded) => {
          await deleteMovement.execute(actor, decoded.id!);
          return decoded.id!;
        },
      ),
      new FinanceLedgerOperation(
        {
          resource: 'finance_obligations',
          operation: 'create',
          fields: obligationCreateFields,
          required: ['name', 'key', 'type', 'amount', 'category_id'],
          dto: CreateFinanceObligationDto,
        },
        ledger,
        async (actor, decoded) => {
          const result = await createObligation.execute(
            actor,
            plainToInstance(CreateFinanceObligationDto, decoded.command),
          );
          if (result.user_id !== decoded.ownerId)
            throw new InternalServerErrorException('nodia_ai:invalid_output');
          return result.id;
        },
      ),
      new FinanceLedgerOperation(
        {
          resource: 'finance_obligations',
          operation: 'update',
          fields: obligationUpdateFields,
          required: [],
          dto: UpdateFinanceObligationDto,
        },
        ledger,
        async (actor, decoded) => {
          const result = await updateObligation.execute(
            actor,
            decoded.id!,
            plainToInstance(UpdateFinanceObligationDto, decoded.command),
          );
          if (result.user_id !== decoded.ownerId)
            throw new InternalServerErrorException('nodia_ai:invalid_output');
          return result.id;
        },
      ),
      new FinanceLedgerOperation(
        {
          resource: 'finance_obligations',
          operation: 'delete',
          fields: {},
          required: [],
        },
        ledger,
        async (actor, decoded) => {
          await deleteObligation.execute(actor, decoded.id!);
          return decoded.id!;
        },
      ),
    ]);
  }
}
