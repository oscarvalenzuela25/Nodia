import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  currentActor,
  lockAuthority,
} from '../../authorization/authority-transaction.js';
import type {
  NodiaAiJsonObject,
  NodiaAiJsonValue,
} from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  ProposalFieldEdit,
  ProposalPreparation,
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import type { NodiaAiProposalReviewField } from '../../nodia-ai-proposal/types/proposal-review.types.js';
import { RentalClock } from '../../rental-common/rental-clock.js';
import { capturePolicySnapshot } from '../../rental-common/rental-money.js';
import {
  formatLocalOn,
  isRentalInstant,
} from '../../rental-common/rental-time.js';
import {
  canonicalRentalCommand,
  requireRequestKey,
} from '../../rental-common/rental-transaction.service.js';
import {
  isRentalId,
  validateRentalDto,
} from '../../rental-common/rental-validation.js';
import type {
  MutationResult,
  RentalContext,
} from '../../rental-common/types/rental.types.js';
import type { RentalProperty } from '../../rental-property/entities/rental-property.entity.js';
import type { RentalReservation } from '../../rental-reservation/entities/rental-reservation.entity.js';
import {
  CreateRentalPaymentDto,
  RentalPlatformPolicyDto,
  VoidRentalPaymentDto,
} from '../../rental-payment/dto/rental-payment.dto.js';
import { CreateRentalPaymentUseCase } from '../../rental-payment/use-case/create-rental-payment.use-case.js';
import { VoidRentalPaymentUseCase } from '../../rental-payment/use-case/void-rental-payment.use-case.js';
import {
  CreateRentalExpenseDto,
  UpdateRentalExpenseDto,
  PayRentalExpenseDto,
  VoidRentalExpenseDto,
} from '../../rental-expense/dto/rental-expense.dto.js';
import { CreateRentalExpenseUseCase } from '../../rental-expense/use-case/create-rental-expense.use-case.js';
import { UpdateRentalExpenseUseCase } from '../../rental-expense/use-case/update-rental-expense.use-case.js';
import { PayRentalExpenseUseCase } from '../../rental-expense/use-case/pay-rental-expense.use-case.js';
import { VoidRentalExpenseUseCase } from '../../rental-expense/use-case/void-rental-expense.use-case.js';
import { validateExpenseDates } from '../../rental-expense/use-case/rental-expense.rules.js';
import { NodiaAiRentalMoneyService } from '../nodia-ai-rental-money.service.js';
import type {
  NodiaAiRentalMoneyAction as Action,
  NodiaAiRentalMoneyOperation,
  NodiaAiRentalMoneyResource as Resource,
} from '../types/rental-money-operation.types.js';

const route = '/reservations';
interface Input {
  property?: string;
  id?: string;
  key: string;
  command: NodiaAiJsonObject;
  origins: NodiaAiJsonObject;
}
type Writer = (i: Input, c: ProposalPreparerContext) => Promise<MutationResult>;
const paymentFields = {
  reservation_id: 'id',
  type: 'enum',
  amount: 'money',
  occurred_on: 'civil_date',
  method: 'nullable_string',
  reference: 'nullable_string',
  notes: 'nullable_string',
  platform_policy: 'platform_policy',
};
const expenseFields = {
  name: 'string',
  amount: 'money',
  incurred_on: 'civil_date',
  status: 'enum',
  paid_on: 'nullable_civil_date',
  reservation_id: 'nullable_id',
  category: 'nullable_string',
  notes: 'nullable_string',
};
const invalid = (): never => {
  throw new BadRequestException('nodia_ai:invalid_input');
};
function object(v: unknown): NodiaAiJsonObject {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return invalid();
  return v as NodiaAiJsonObject;
}
function review(v: NodiaAiJsonValue): NodiaAiJsonValue {
  if (Array.isArray(v)) return { kind: 'array', items: v.map(review) };
  if (v !== null && typeof v === 'object')
    return {
      kind: 'object',
      fields: Object.entries(v).map(([field_key, value]) => ({
        field_key,
        value: review(value),
      })),
    };
  return v;
}
function pick(
  v: NodiaAiJsonObject,
  keys: readonly string[],
): NodiaAiJsonObject {
  return Object.fromEntries(
    Object.entries(v).filter(([key]) => keys.includes(key)),
  );
}
const identity = (c: ProposalPreparerContext) => ({
  userId: c.actor.actorId,
  sessionId: c.actor.sessionId,
  transaction: c.manager,
  statementTimeoutMs: c.statementTimeoutMs,
});

class RentalMoneyOperation implements NodiaAiRentalMoneyOperation {
  readonly toolName: string;
  readonly catalogVersion = 'nodia-ai-ai26-rental-money/1';
  readonly moduleRoutes = [route];
  readonly actionKeys: readonly string[] = [];
  readonly bindableFields: Readonly<Record<string, string>> = {};
  readonly outputKeys: Readonly<Record<string, string>>;
  readonly editableFields: Readonly<Record<string, string>>;
  readonly reviewFields: readonly NodiaAiProposalReviewField[];
  readonly contractHash: string;
  private readonly commandFields: Readonly<Record<string, string>>;
  constructor(
    readonly resourceKey: Resource,
    readonly operation: Action,
    private readonly store: NodiaAiRentalMoneyService,
    private readonly clock: RentalClock,
    private readonly writer: Writer,
  ) {
    this.toolName = `nodia_${resourceKey}_prepare_${operation}`;
    this.outputKeys = {
      id:
        resourceKey === 'rental_payments'
          ? 'rental_payment_id'
          : 'rental_expense_id',
    };
    this.commandFields =
      operation === 'void'
        ? { reason: 'string' }
        : operation === 'pay'
          ? { paid_on: 'civil_date' }
          : resourceKey === 'rental_payments'
            ? paymentFields
            : operation === 'create'
              ? expenseFields
              : Object.fromEntries(
                  Object.entries(expenseFields).filter(
                    ([key]) => !['status', 'paid_on'].includes(key),
                  ),
                );
    this.editableFields = Object.fromEntries(
      Object.entries(this.commandFields).filter(
        ([key]) => key !== 'platform_policy',
      ),
    );
    this.reviewFields = Object.keys(this.editableFields).map((field_key) => ({
      field_key,
      label_key: `nodiaAi:proposal.rental_fields.${field_key}`,
      kind: ['amount', 'reservation_id'].includes(field_key)
        ? 'bigint'
        : ['type', 'status'].includes(field_key)
          ? 'enum'
          : 'text',
      nullable: this.commandFields[field_key].startsWith('nullable_'),
      max_length:
        field_key === 'notes'
          ? 5000
          : field_key === 'reason'
            ? 1000
            : ['method', 'category'].includes(field_key)
              ? 100
              : ['name', 'reference'].includes(field_key)
                ? 255
                : null,
      minimum: ['amount', 'reservation_id'].includes(field_key) ? '1' : null,
      maximum: ['amount', 'reservation_id'].includes(field_key)
        ? '9223372036854775807'
        : null,
      options: (field_key === 'type'
        ? ['payment', 'refund']
        : field_key === 'status'
          ? ['pending', 'paid']
          : []
      ).map((value) => ({
        value,
        label_key: `nodiaAi:proposal.rental_values.${field_key}.${value}`,
      })),
    }));
    this.contractHash = createHash('sha256')
      .update(
        JSON.stringify({
          version: this.catalogVersion,
          resourceKey,
          operation,
          fields: this.commandFields,
          editable: this.editableFields,
          template: 1,
          preconditions: 'locked-property-money-action-material/1',
          requestKey: 'backend_uuid_v4_fixed_per_intent/1',
        }),
      )
      .digest('hex');
  }
  private dto() {
    return this.operation === 'void'
      ? this.resourceKey === 'rental_payments'
        ? VoidRentalPaymentDto
        : VoidRentalExpenseDto
      : this.operation === 'pay'
        ? PayRentalExpenseDto
        : this.resourceKey === 'rental_payments'
          ? CreateRentalPaymentDto
          : this.operation === 'create'
            ? CreateRentalExpenseDto
            : UpdateRentalExpenseDto;
  }
  private decode(raw: NodiaAiJsonObject, stored = false): Input {
    const allowed = stored
      ? [
          'schema_version',
          'property_id',
          'id',
          'request_key',
          'command',
          'origins',
        ]
      : ['property_id', 'id', ...Object.keys(this.commandFields)];
    if (
      Object.keys(raw).some((k) => !allowed.includes(k)) ||
      (stored && raw.schema_version !== 1)
    )
      return invalid();
    const property = raw.property_id,
      id = raw.id;
    if (
      (property !== undefined && !isRentalId(property)) ||
      (id !== undefined && !isRentalId(id)) ||
      (this.operation === 'create' && id !== undefined)
    )
      return invalid();
    let command = stored
      ? { ...object(raw.command) }
      : Object.fromEntries(
          Object.entries(raw).filter(
            ([key]) => !['property_id', 'id'].includes(key),
          ),
        );
    const origins = stored
      ? { ...object(raw.origins) }
      : Object.fromEntries(Object.keys(command).map((key) => [key, 'user']));
    if (
      Object.keys(command).some(
        (key) =>
          !Object.hasOwn(this.commandFields, key) || command[key] === undefined,
      ) ||
      Object.keys(origins).length !== Object.keys(command).length ||
      Object.keys(command).some((key) => !Object.hasOwn(origins, key)) ||
      Object.values(origins).some(
        (v) => !['user', 'database', 'contract_default'].includes(String(v)),
      )
    )
      return invalid();
    if (Buffer.byteLength(JSON.stringify(command)) > 65536)
      throw new ConflictException('nodia_ai:result_too_large');
    const partial = plainToInstance(this.dto() as new () => object, command);
    if (
      validateSync(partial, {
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
        skipMissingProperties: true,
      }).length
    )
      return invalid();
    if (command.platform_policy !== undefined) {
      const platform = plainToInstance(
        RentalPlatformPolicyDto,
        object(command.platform_policy),
      );
      if (
        validateSync(platform, {
          whitelist: true,
          forbidNonWhitelisted: true,
          forbidUnknownValues: true,
        }).length
      )
        return invalid();
      command.platform_policy = {
        reference: platform.reference,
        description: platform.description,
      };
    }
    for (const key of Object.keys(command))
      if (key !== 'platform_policy')
        command[key] = (partial as NodiaAiJsonObject)[key];
    command = canonicalRentalCommand(command) as NodiaAiJsonObject;
    return {
      property: property as string | undefined,
      id: id as string | undefined,
      key: stored ? requireRequestKey(raw.request_key) : randomUUID(),
      command,
      origins,
    };
  }
  private template(i: Input): NodiaAiJsonObject {
    return {
      schema_version: 1,
      ...(i.property ? { property_id: i.property } : {}),
      ...(i.id ? { id: i.id } : {}),
      request_key: i.key,
      command: i.command,
      origins: i.origins,
    };
  }
  private scope(i: Input): NodiaAiJsonObject {
    return { property_id: i.property! };
  }
  private async authority(c: ProposalPreparerContext) {
    if (
      !c.manager.queryRunner?.isTransactionActive ||
      !c.moduleRoutes.includes(route)
    )
      throw new ForbiddenException('nodia_ai:capability_denied');
    await lockAuthority(c.manager, false, c.statementTimeoutMs);
    return currentActor(c.manager, identity(c));
  }
  private async context(
    i: Input,
    c: ProposalPreparerContext,
  ): Promise<RentalContext> {
    const actor = await this.authority(c);
    if (!i.property) return invalid();
    const property = await this.store.property(c.manager, i.property);
    if (!property) throw new NotFoundException('rental:not_found');
    const owner = property.owner_id === actor.actorId;
    if (
      !owner &&
      !actor.isSuperAdmin &&
      !(await this.store.member(c.manager, i.property, actor.actorId))
    )
      throw new NotFoundException('rental:not_found');
    return {
      manager: c.manager,
      property: property as unknown as RentalProperty,
      actorId: actor.actorId,
      owner,
      isSuperAdmin: actor.isSuperAdmin,
      now: this.clock.now(),
    };
  }
  async prepare(
    raw: NodiaAiJsonObject,
    c: ProposalPreparerContext,
    previous?: NodiaAiJsonObject,
  ): Promise<ProposalPreparation> {
    const next = this.decode(raw),
      old = previous ? this.decode(previous, true) : null;
    if (old) {
      if (
        (next.property && old.property && next.property !== old.property) ||
        (next.id && old.id && next.id !== old.id)
      )
        return invalid();
      next.property ??= old.property;
      next.id ??= old.id;
      next.key = old.key;
      next.command = { ...old.command, ...next.command };
      next.origins = { ...old.origins, ...next.origins };
    }
    return this.prepareInput(next, c);
  }
  reprepareStored(t: NodiaAiJsonObject, c: ProposalPreparerContext) {
    return this.prepareInput(this.decode(t, true), c);
  }
  private async prepareInput(
    i: Input,
    c: ProposalPreparerContext,
  ): Promise<ProposalPreparation> {
    await this.authority(c);
    const missing: string[] = [];
    if (!i.property) missing.push('property_id');
    if (this.operation !== 'create' && !i.id) missing.push('id');
    const required =
      this.operation === 'void'
        ? ['reason']
        : this.operation === 'pay'
          ? ['paid_on']
          : this.operation === 'create'
            ? this.resourceKey === 'rental_payments'
              ? ['reservation_id', 'type', 'amount', 'occurred_on']
              : ['name', 'amount', 'incurred_on', 'status']
            : [];
    for (const key of required)
      if (!Object.hasOwn(i.command, key)) missing.push(key);
    if (this.operation === 'update' && !Object.keys(i.command).length)
      missing.push('changes');
    if (
      this.resourceKey === 'rental_expenses' &&
      this.operation === 'create' &&
      i.command.status === 'paid' &&
      (i.command.paid_on === undefined || i.command.paid_on === null)
    )
      missing.push('paid_on');
    if (
      !missing.length &&
      this.resourceKey === 'rental_payments' &&
      this.operation === 'create' &&
      i.command.type === 'payment'
    ) {
      await this.context(i, c);
      const row = await this.store.reservation(
        c.manager,
        i.property!,
        String(i.command.reservation_id),
      );
      if (!row) throw new NotFoundException('rental:not_found');
      if (
        row.channel === 'airbnb' &&
        row.policy_snapshot === null &&
        i.command.platform_policy === undefined
      )
        missing.push('platform_policy');
    }
    if (missing.length)
      return {
        status: 'needs_clarification',
        partial: this.template(i),
        missingFields: missing,
        clarificationKeys: missing.map(
          (key) => `nodia_ai:rental_${key}_required`,
        ),
      };
    if (this.operation === 'create') {
      const defaults: NodiaAiJsonObject =
        this.resourceKey === 'rental_payments'
          ? { method: null, reference: null, notes: null }
          : {
              paid_on: null,
              reservation_id: null,
              category: null,
              notes: null,
            };
      for (const [key, value] of Object.entries(defaults))
        if (!Object.hasOwn(i.command, key)) {
          i.command[key] = value;
          i.origins[key] = 'contract_default';
        }
    }
    await validateRentalDto(this.dto() as new () => object, i.command);
    const preconditions = await this.snapshot(i, c),
      target =
        preconditions.target === null ? null : object(preconditions.target);
    const changes = Object.entries(i.command).map(([field_key, value]) => ({
      field_key,
      before: target ? review(target[field_key] ?? null) : null,
      before_present: target !== null,
      after: review(value),
      after_present: true,
      origin: i.origins[field_key],
    }));
    const derived: NodiaAiJsonObject = {
      timezone: object(preconditions.property).timezone,
    };
    if (target && ['void', 'pay'].includes(this.operation))
      for (const [key, value] of Object.entries(target))
        if (
          !['id', 'property_id', 'status', 'paid_on'].includes(key) &&
          !Object.hasOwn(i.command, key)
        )
          derived[key] = value;
    if (this.operation === 'void') derived.status = 'voided';
    if (this.operation === 'pay') derived.status = 'paid';
    if (this.resourceKey === 'rental_payments' && this.operation === 'create')
      derived.status = 'confirmed';
    if (this.resourceKey === 'rental_expenses' && this.operation === 'void')
      derived.paid_on = null;
    if (preconditions.money !== null) {
      const money = object(preconditions.money);
      derived.received_amount = money.received;
      if (Object.hasOwn(money, 'refunded'))
        derived.refunded_amount = money.refunded;
    }
    if (preconditions.policy !== null)
      derived.policy_snapshot = preconditions.policy;
    for (const [field_key, value] of Object.entries(derived))
      changes.push({
        field_key,
        before: target ? review(target[field_key] ?? null) : null,
        before_present: target !== null,
        after: review(value),
        after_present: true,
        origin: 'database',
      });
    const scope = this.scope(i);
    return {
      status: 'ready',
      commandTemplate: this.template(i),
      scope,
      preconditions,
      publicStep: {
        tool_name: this.toolName,
        kind: 'domain_change',
        target: target
          ? {
              resource_key: this.resourceKey,
              id: i.id!,
              label: String(target.name ?? target.id),
            }
          : null,
        scope,
        changes,
        depends_on: [],
        effect_key: `${this.resourceKey}.${this.operation}`,
        output_bindings: [],
      },
    };
  }
  async applyEdits(
    template: NodiaAiJsonObject,
    edits: readonly ProposalFieldEdit[],
    c: ProposalPreparerContext,
  ) {
    const i = this.decode(template, true),
      seen = new Set<string>();
    for (const edit of edits) {
      if (
        !Object.hasOwn(this.editableFields, edit.field_key) ||
        seen.has(edit.field_key)
      )
        return invalid();
      seen.add(edit.field_key);
      i.command[edit.field_key] = edit.value;
      i.origins[edit.field_key] = 'user';
    }
    const next = this.decode(this.template(i), true);
    await this.authority(c);
    return this.template(next);
  }
  async verifyAuthority(step: StoredProposalStep, c: ProposalPreparerContext) {
    const i = this.decode(step.commandTemplate, true);
    if (
      step.toolName !== this.toolName ||
      step.contractHash !== this.contractHash ||
      !isDeepStrictEqual(step.scope, this.scope(i))
    )
      throw new ForbiddenException('nodia_ai:capability_denied');
    await this.context(i, c);
  }
  async verifyPreconditions(
    step: StoredProposalStep,
    c: ProposalPreparerContext,
  ) {
    await this.verifyAuthority(step, c);
    try {
      if (
        !isDeepStrictEqual(
          await this.snapshot(this.decode(step.commandTemplate, true), c),
          step.preconditions,
        )
      )
        throw new ConflictException('nodia_ai:preconditions_changed');
    } catch (error) {
      if (
        error instanceof HttpException &&
        [400, 404, 409].includes(error.getStatus())
      )
        throw new ConflictException('nodia_ai:preconditions_changed');
      throw error;
    }
  }
  private async snapshot(
    i: Input,
    c: ProposalPreparerContext,
  ): Promise<NodiaAiJsonObject> {
    const ctx = await this.context(i, c);
    const target = i.id
      ? this.resourceKey === 'rental_payments'
        ? await this.store.payment(c.manager, i.property!, i.id)
        : await this.store.expense(c.manager, i.property!, i.id)
      : null;
    if (i.id && !target) throw new NotFoundException('rental:not_found');
    let materialTarget = target,
      association: NodiaAiJsonObject | null = null,
      money: NodiaAiJsonObject | null = null,
      policy: NodiaAiJsonObject | null = null;
    if (this.resourceKey === 'rental_payments') {
      const reservationId = String(
        target ? target.reservation_id : i.command.reservation_id,
      );
      const row = await this.store.reservation(
        c.manager,
        i.property!,
        reservationId,
      );
      if (!row) throw new NotFoundException('rental:not_found');
      const type = target ? target.type : i.command.type;
      const totals = await this.store.totals(
        c.manager,
        i.property!,
        reservationId,
      );
      association = pick(row, ['id', 'property_id', 'status']);
      if (target) {
        if (target.status !== 'confirmed')
          throw new ConflictException('rental:invalid_transition');
        if (type === 'payment') {
          if (row.status === 'cancelled')
            throw new ConflictException('rental:invalid_transition');
          association = {
            ...association,
            ...pick(row, ['channel', 'deposit_amount']),
          };
          money = { received: totals.received };
          if (
            row.channel !== 'airbnb' &&
            row.status !== 'draft' &&
            BigInt(totals.received) - BigInt(String(target.amount)) <
              BigInt(String(row.deposit_amount))
          )
            throw new ConflictException('rental:deposit_required');
        } else if (row.status !== 'cancelled')
          throw new ConflictException('rental:invalid_transition');
      } else {
        const amount = BigInt(String(i.command.amount));
        if (
          String(i.command.occurred_on) >
          formatLocalOn(ctx.now, ctx.property.timezone)
        )
          throw new BadRequestException('rental:invalid_input');
        if (type === 'payment') {
          if (row.status === 'cancelled')
            throw new ConflictException('rental:invalid_transition');
          association = {
            ...association,
            ...pick(row, [
              'channel',
              'total_amount',
              'commission_amount',
              'deposit_amount',
              'policy_snapshot',
            ]),
          };
          money = { received: totals.received };
          const expected =
            BigInt(String(row.total_amount)) -
            BigInt(String(row.commission_amount));
          if (BigInt(totals.received) + amount > expected)
            throw new ConflictException('rental:overpayment');
          if (
            row.channel !== 'airbnb' &&
            (BigInt(String(row.deposit_amount)) <= 0n ||
              BigInt(String(row.deposit_amount)) > expected)
          )
            throw new ConflictException('rental:deposit_required');
          if (
            i.command.platform_policy &&
            (row.channel !== 'airbnb' ||
              row.status !== 'draft' ||
              row.policy_snapshot !== null)
          )
            throw new BadRequestException('rental:invalid_input');
          if (row.policy_snapshot === null) {
            const captured = await capturePolicySnapshot(
              ctx,
              row as unknown as RentalReservation,
              i.command.platform_policy as unknown as
                RentalPlatformPolicyDto | undefined,
            );
            const { captured_at: _captured, ...stable } = captured;
            policy = stable as unknown as NodiaAiJsonObject;
          }
        } else {
          if (i.command.platform_policy)
            throw new BadRequestException('rental:invalid_input');
          if (row.status !== 'cancelled' || row.refund_amount === null)
            throw new ConflictException('rental:invalid_transition');
          association = {
            ...association,
            ...pick(row, ['cancelled_at', 'refund_amount']),
          };
          money = totals;
          if (
            amount + BigInt(totals.refunded) >
              BigInt(String(row.refund_amount)) ||
            amount + BigInt(totals.refunded) > BigInt(totals.received)
          )
            throw new ConflictException('rental:refund_exceeds_approved');
          if (
            !row.cancelled_at ||
            String(i.command.occurred_on) <
              formatLocalOn(
                new Date(String(row.cancelled_at)),
                ctx.property.timezone,
              )
          )
            throw new BadRequestException('rental:invalid_input');
        }
      }
    } else {
      if (
        target?.status === 'voided' ||
        (this.operation === 'pay' && target?.status !== 'pending')
      )
        throw new ConflictException('rental:invalid_transition');
      if (
        this.operation === 'update' &&
        target?.status === 'paid' &&
        ['amount', 'incurred_on'].some((key) => Object.hasOwn(i.command, key))
      )
        throw new ConflictException('rental:agreement_immutable');
      const effective = { ...target, ...i.command };
      if (this.operation === 'create' || this.operation === 'update') {
        validateExpenseDates(
          ctx,
          String(effective.incurred_on),
          effective.paid_on as string | null,
          String(effective.status),
        );
        if (effective.reservation_id !== null) {
          const associated = await this.store.reservation(
            c.manager,
            i.property!,
            String(effective.reservation_id),
          );
          if (!associated) throw new NotFoundException('rental:not_found');
          association = pick(associated, ['id', 'property_id']);
        }
      }
      if (this.operation === 'pay')
        validateExpenseDates(
          ctx,
          String(target!.incurred_on),
          String(i.command.paid_on),
          'paid',
        );
      if (target)
        materialTarget = pick(
          target,
          this.operation === 'void'
            ? ['id', 'property_id', 'name', 'amount', 'status', 'paid_on']
            : this.operation === 'pay'
              ? ['id', 'property_id', 'name', 'amount', 'incurred_on', 'status']
              : [
                  'id',
                  'property_id',
                  'name',
                  'status',
                  'incurred_on',
                  'paid_on',
                  'reservation_id',
                  ...Object.keys(i.command),
                ],
        );
    }
    const snapshot = {
      schema_version: 1,
      property: pick(ctx.property as unknown as NodiaAiJsonObject, [
        'id',
        'timezone',
      ]),
      target: materialTarget,
      association,
      money,
      policy,
    };
    if (Buffer.byteLength(JSON.stringify(snapshot)) > 262144)
      throw new ConflictException('nodia_ai:result_too_large');
    return snapshot;
  }
  async executeConfirmed(step: StoredProposalStep, c: ProposalPreparerContext) {
    const i = this.decode(step.commandTemplate, true);
    if (
      !isDeepStrictEqual(this.template(i), step.commandTemplate) ||
      step.outputBindings.length ||
      !Array.isArray(step.publicStep.depends_on) ||
      step.publicStep.depends_on.length
    )
      return invalid();
    await validateRentalDto(this.dto() as new () => object, i.command);
    await this.verifyPreconditions(step, c);
    const result = await this.writer(i, c),
      resource = this.resourceKey === 'rental_payments' ? 'payment' : 'expense';
    const expectedStatus =
      this.operation === 'void'
        ? 'voided'
        : this.operation === 'pay'
          ? 'paid'
          : this.operation === 'create'
            ? resource === 'payment'
              ? 'confirmed'
              : i.command.status
            : object(step.preconditions.target).status;
    if (
      !result ||
      Object.keys(result).sort().join(',') !==
        [
          'operation',
          'property_id',
          'resource_type',
          'resource_id',
          'status',
          'updated_at',
        ]
          .sort()
          .join(',') ||
      result.operation !== `${resource}.${this.operation}` ||
      result.resource_type !== resource ||
      !isRentalId(result.resource_id) ||
      result.property_id !== i.property ||
      (i.id && result.resource_id !== i.id) ||
      result.status !== expectedStatus ||
      !isRentalInstant(result.updated_at)
    )
      throw new InternalServerErrorException('nodia_ai:invalid_output');
    return { id: result.resource_id, propertyId: result.property_id };
  }
}

@Injectable()
export class BuildNodiaAiRentalMoneyOperationsUseCase {
  readonly operations: readonly NodiaAiRentalMoneyOperation[];
  constructor(
    store: NodiaAiRentalMoneyService,
    clock: RentalClock,
    createPayment: CreateRentalPaymentUseCase,
    voidPayment: VoidRentalPaymentUseCase,
    createExpense: CreateRentalExpenseUseCase,
    updateExpense: UpdateRentalExpenseUseCase,
    payExpense: PayRentalExpenseUseCase,
    voidExpense: VoidRentalExpenseUseCase,
  ) {
    this.operations = Object.freeze([
      new RentalMoneyOperation(
        'rental_payments',
        'create',
        store,
        clock,
        (i, c) =>
          createPayment.execute(
            identity(c),
            i.property!,
            i.command as unknown as CreateRentalPaymentDto,
            i.key,
          ),
      ),
      new RentalMoneyOperation(
        'rental_payments',
        'void',
        store,
        clock,
        (i, c) =>
          voidPayment.execute(
            identity(c),
            i.property!,
            i.id!,
            i.command as unknown as VoidRentalPaymentDto,
            i.key,
          ),
      ),
      new RentalMoneyOperation(
        'rental_expenses',
        'create',
        store,
        clock,
        (i, c) =>
          createExpense.execute(
            identity(c),
            i.property!,
            i.command as unknown as CreateRentalExpenseDto,
            i.key,
          ),
      ),
      new RentalMoneyOperation(
        'rental_expenses',
        'update',
        store,
        clock,
        (i, c) =>
          updateExpense.execute(
            identity(c),
            i.property!,
            i.id!,
            i.command as UpdateRentalExpenseDto,
            i.key,
          ),
      ),
      new RentalMoneyOperation('rental_expenses', 'pay', store, clock, (i, c) =>
        payExpense.execute(
          identity(c),
          i.property!,
          i.id!,
          i.command as unknown as PayRentalExpenseDto,
          i.key,
        ),
      ),
      new RentalMoneyOperation(
        'rental_expenses',
        'void',
        store,
        clock,
        (i, c) =>
          voidExpense.execute(
            identity(c),
            i.property!,
            i.id!,
            i.command as unknown as VoidRentalExpenseDto,
            i.key,
          ),
      ),
    ]);
  }
}
