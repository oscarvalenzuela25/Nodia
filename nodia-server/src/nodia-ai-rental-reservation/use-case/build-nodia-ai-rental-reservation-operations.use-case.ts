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
import { CreateRentalReservationDto } from '../../rental-reservation/dto/create-rental-reservation.dto.js';
import { UpdateRentalReservationDto } from '../../rental-reservation/dto/update-rental-reservation.dto.js';
import {
  CancelRentalReservationDto,
  ConfirmRentalReservationDto,
  EmptyRentalCommandDto,
  PlatformPolicyDto,
  PreviewRentalCancellationDto,
} from '../../rental-reservation/dto/reservation-commands.dto.js';
import { CreateRentalReservationUseCase } from '../../rental-reservation/use-case/create-rental-reservation.use-case.js';
import { UpdateRentalReservationUseCase } from '../../rental-reservation/use-case/update-rental-reservation.use-case.js';
import { ConfirmRentalReservationUseCase } from '../../rental-reservation/use-case/confirm-rental-reservation.use-case.js';
import { StartRentalReservationUseCase } from '../../rental-reservation/use-case/start-rental-reservation.use-case.js';
import { CompleteRentalReservationUseCase } from '../../rental-reservation/use-case/complete-rental-reservation.use-case.js';
import { CancelRentalReservationUseCase } from '../../rental-reservation/use-case/cancel-rental-reservation.use-case.js';
import {
  validateAgreement,
  assertPhase,
} from '../../rental-reservation/types/rental-reservation.rules.js';
import { cancellationCalculation } from '../../rental-reservation/types/rental-cancellation.rules.js';
import { capturePolicySnapshot } from '../../rental-common/rental-money.js';
import {
  calendarStay,
  sameDayValid,
  sameDay,
  refreshPlan,
  planValid,
  type TurnoverPlan,
} from '../../rental-common/rental-calendar.rules.js';
import {
  isRentalId,
  validateRentalDto,
  assertEmptyCommand,
} from '../../rental-common/rental-validation.js';
import {
  canonicalRentalCommand,
  requireRequestKey,
} from '../../rental-common/rental-transaction.service.js';
import { isRentalInstant } from '../../rental-common/rental-time.js';
import { RentalClock } from '../../rental-common/rental-clock.js';
import type {
  MutationResult,
  RentalContext,
} from '../../rental-common/types/rental.types.js';
import type { RentalReservation } from '../../rental-reservation/entities/rental-reservation.entity.js';
import type { RentalProperty } from '../../rental-property/entities/rental-property.entity.js';
import { NodiaAiRentalReservationService } from '../nodia-ai-rental-reservation.service.js';
import type {
  NodiaAiRentalReservationAction,
  NodiaAiRentalReservationOperation,
} from '../types/rental-reservation-operation.types.js';

const route = '/reservations';
type Action = NodiaAiRentalReservationAction;
interface Input {
  property?: string;
  id?: string;
  key: string;
  command: NodiaAiJsonObject;
  origins: NodiaAiJsonObject;
}
type Writer = (i: Input, c: ProposalPreparerContext) => Promise<MutationResult>;
const fields: Readonly<Record<string, string>> = {
  guest_name: 'string',
  guest_contact: 'string',
  guests_count: 'integer',
  channel: 'enum',
  external_reference: 'nullable_string',
  check_in_on: 'civil_date',
  check_out_on: 'civil_date',
  check_in_time: 'local_time',
  check_out_time: 'local_time',
  nightly_rate: 'positive_money',
  cleaning_fee: 'money',
  discount_amount: 'money',
  commission_amount: 'money',
  deposit_amount: 'money',
  deposit_due_at: 'nullable_instant',
  balance_due_at: 'nullable_instant',
  cancellation_policy_id: 'nullable_policy_id',
  notes: 'nullable_string',
  is_active: 'boolean',
};
const required = [
  'guest_name',
  'guest_contact',
  'guests_count',
  'channel',
  'check_in_on',
  'check_out_on',
  'check_in_time',
  'check_out_time',
  'nightly_rate',
  'deposit_amount',
];
const defaults: NodiaAiJsonObject = {
  external_reference: null,
  cleaning_fee: '0',
  discount_amount: '0',
  commission_amount: '0',
  deposit_due_at: null,
  balance_due_at: null,
  cancellation_policy_id: null,
  notes: null,
  is_active: true,
};
const invalid = (): never => {
  throw new BadRequestException('nodia_ai:invalid_input');
};
const object = (v: unknown): NodiaAiJsonObject => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return invalid();
  return v as NodiaAiJsonObject;
};
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
const identity = (c: ProposalPreparerContext) => ({
  userId: c.actor.actorId,
  sessionId: c.actor.sessionId,
  transaction: c.manager,
  statementTimeoutMs: c.statementTimeoutMs,
});
function reservation(v: NodiaAiJsonObject): RentalReservation {
  return {
    ...v,
    ...Object.fromEntries(
      ['deposit_due_at', 'balance_due_at', 'cancelled_at'].map((k) => [
        k,
        v[k] === null || v[k] === undefined ? null : new Date(String(v[k])),
      ]),
    ),
  } as unknown as RentalReservation;
}
function turnover(raw: NodiaAiJsonObject): TurnoverPlan {
  return {
    id: String(raw.id),
    incoming_reservation_id: String(raw.incoming_reservation_id),
    previous_reservation_id: raw.previous_reservation_id as string | null,
    linen_ready: raw.linen_ready as boolean | null,
    cleaning_status: String(raw.cleaning_status),
    planned_ready_at: raw.planned_ready_at
      ? new Date(String(raw.planned_ready_at))
      : null,
    ready_at: raw.ready_at ? new Date(String(raw.ready_at)) : null,
    same_day_approved_at: raw.same_day_approved_at
      ? new Date(String(raw.same_day_approved_at))
      : null,
  };
}
function dto(action: Action) {
  return action === 'create'
    ? CreateRentalReservationDto
    : action === 'update'
      ? UpdateRentalReservationDto
      : action === 'confirm'
        ? ConfirmRentalReservationDto
        : action === 'cancel'
          ? CancelRentalReservationDto
          : EmptyRentalCommandDto;
}

class RentalReservationOperation implements NodiaAiRentalReservationOperation {
  readonly resourceKey = 'rental_reservations';
  readonly toolName: string;
  readonly catalogVersion = 'nodia-ai-ai25-rental-reservation/1';
  readonly moduleRoutes = [route];
  readonly actionKeys: readonly string[] = [];
  readonly bindableFields: Readonly<Record<string, string>> = {};
  readonly outputKeys = { id: 'rental_reservation_id' };
  readonly editableFields: Readonly<Record<string, string>>;
  readonly reviewFields: readonly NodiaAiProposalReviewField[];
  readonly contractHash: string;
  private readonly commandFields: Readonly<Record<string, string>>;
  constructor(
    readonly operation: Action,
    private readonly store: NodiaAiRentalReservationService,
    private readonly clock: RentalClock,
    private readonly writer: Writer,
  ) {
    this.toolName = `nodia_rental_reservations_prepare_${operation}`;
    this.commandFields =
      operation === 'create' || operation === 'update'
        ? fields
        : operation === 'confirm'
          ? {
              same_day_approvals: 'rental_turnover_ids',
              platform_policy: 'platform_policy',
            }
          : operation === 'cancel'
            ? {
                cancelled_at: 'instant',
                refund_amount: 'money',
                resolution_note: 'string',
                expected_refund_amount: 'money',
              }
            : {};
    this.editableFields = Object.fromEntries(
      Object.entries(this.commandFields).filter(
        ([key]) =>
          ![
            'same_day_approvals',
            'platform_policy',
            'expected_refund_amount',
          ].includes(key),
      ),
    );
    this.reviewFields = Object.keys(this.editableFields).map((field_key) => ({
      field_key,
      label_key: `nodiaAi:proposal.rental_fields.${field_key}`,
      kind:
        field_key === 'is_active'
          ? 'boolean'
          : field_key === 'guests_count'
            ? 'integer'
            : field_key === 'channel'
              ? 'enum'
              : this.commandFields[field_key].includes('money') ||
                  field_key === 'cancellation_policy_id'
                ? 'bigint'
                : 'text',
      nullable: [
        'external_reference',
        'deposit_due_at',
        'balance_due_at',
        'cancellation_policy_id',
        'notes',
      ].includes(field_key),
      max_length:
        field_key === 'notes'
          ? 5000
          : field_key === 'resolution_note'
            ? 1000
            : ['guest_name', 'guest_contact', 'external_reference'].includes(
                  field_key,
                )
              ? 255
              : null,
      minimum:
        field_key === 'guests_count' ||
        field_key === 'nightly_rate' ||
        field_key === 'cancellation_policy_id'
          ? '1'
          : this.commandFields[field_key].includes('money')
            ? '0'
            : null,
      maximum:
        field_key === 'guests_count'
          ? '1000'
          : this.commandFields[field_key].includes('money') ||
              field_key === 'cancellation_policy_id'
            ? '9223372036854775807'
            : null,
      options:
        field_key === 'channel'
          ? ['whatsapp', 'airbnb', 'facebook', 'other'].map((value) => ({
              value,
              label_key: `nodiaAi:proposal.rental_values.channel.${value}`,
            }))
          : [],
    }));
    this.contractHash = createHash('sha256')
      .update(
        JSON.stringify({
          version: this.catalogVersion,
          operation,
          fields: this.commandFields,
          editable: this.editableFields,
          template: 1,
          preconditions:
            'locked-property-agreement-ledger-calendar-preparation-policy/1',
          cancel: 'native-fixed-instant-derived-refund-no-time-volatile/1',
          requestKey: 'backend_uuid_v4_fixed_per_intent/1',
        }),
      )
      .digest('hex');
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
      : [
          'property_id',
          'id',
          ...Object.keys(this.commandFields).filter(
            (k) => k !== 'expected_refund_amount',
          ),
        ];
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
            ([k]) => k !== 'property_id' && k !== 'id',
          ),
        );
    const origins = stored
      ? { ...object(raw.origins) }
      : Object.fromEntries(Object.keys(command).map((k) => [k, 'user']));
    if (
      Object.keys(command).some(
        (k) =>
          !Object.hasOwn(this.commandFields, k) || command[k] === undefined,
      ) ||
      Object.keys(origins).length !== Object.keys(command).length ||
      Object.keys(command).some((k) => !Object.hasOwn(origins, k)) ||
      Object.values(origins).some(
        (v) => !['user', 'database', 'contract_default'].includes(String(v)),
      )
    )
      return invalid();
    if (Buffer.byteLength(JSON.stringify(command)) > 65536)
      throw new ConflictException('nodia_ai:result_too_large');
    const partialDto = plainToInstance(
      dto(this.operation) as new () => object,
      command,
    );
    if (
      !['start', 'complete'].includes(this.operation) &&
      validateSync(partialDto, {
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
        skipMissingProperties: true,
      }).length
    )
      return invalid();
    if (command.platform_policy !== undefined) {
      const platform = plainToInstance(
        PlatformPolicyDto,
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
    for (const key of Object.keys(command)) {
      if (key !== 'platform_policy')
        command[key] = (partialDto as NodiaAiJsonObject)[key];
    }
    // Apply the native journal's canonicalization before hashing/public review.
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
    if (this.operation === 'create')
      for (const key of required)
        if (!Object.hasOwn(i.command, key)) missing.push(key);
    if (this.operation === 'update' && !Object.keys(i.command).length)
      missing.push('changes');
    if (
      this.operation === 'cancel' &&
      !Object.hasOwn(i.command, 'cancelled_at')
    )
      missing.push('cancelled_at');
    if (!missing.length) {
      const ctx = await this.context(i, c);
      const target = i.id
        ? await this.store.reservation(c.manager, i.property!, i.id)
        : null;
      if (i.id && !target) throw new NotFoundException('rental:not_found');
      if (
        this.operation === 'confirm' &&
        target?.channel === 'airbnb' &&
        i.command.platform_policy === undefined
      )
        missing.push('platform_policy');
      if (this.operation === 'cancel' && target?.channel === 'airbnb')
        for (const key of ['refund_amount', 'resolution_note'])
          if (!Object.hasOwn(i.command, key)) missing.push(key);
      if (this.operation === 'create' && !ctx.property.is_active)
        throw new ConflictException('rental:property_inactive');
    }
    if (missing.length)
      return {
        status: 'needs_clarification',
        partial: this.template(i),
        missingFields: missing,
        clarificationKeys: missing.map((k) => `nodia_ai:rental_${k}_required`),
      };
    if (this.operation === 'create')
      for (const [key, value] of Object.entries(defaults))
        if (!Object.hasOwn(i.command, key)) {
          i.command[key] = value;
          i.origins[key] = 'contract_default';
        }
    if (
      this.operation === 'confirm' &&
      i.command.same_day_approvals === undefined
    ) {
      i.command.same_day_approvals = [];
      i.origins.same_day_approvals = 'contract_default';
    }
    if (['start', 'complete'].includes(this.operation))
      assertEmptyCommand(i.command);
    else if (this.operation !== 'cancel')
      await validateRentalDto(
        dto(this.operation) as new () => object,
        i.command,
      );
    const preconditions = await this.snapshot(i, c);
    if (this.operation === 'cancel') {
      i.command.expected_refund_amount = object(
        preconditions.cancellation,
      ).refund_amount;
      i.origins.expected_refund_amount = 'database';
      await validateRentalDto(CancelRentalReservationDto, i.command);
    }
    const target =
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
    if (preconditions.total_amount !== null)
      derived.total_amount = preconditions.total_amount;
    if (this.operation === 'create' || !['update'].includes(this.operation))
      derived.status =
        this.operation === 'create'
          ? 'draft'
          : this.operation === 'confirm'
            ? 'confirmed'
            : this.operation === 'start'
              ? 'in_progress'
              : this.operation === 'complete'
                ? 'completed'
                : 'cancelled';
    if (this.operation === 'cancel') {
      const cancel = object(preconditions.cancellation),
        snapshot = object(cancel.cancellation_snapshot);
      for (const key of [
        'balance_due_after_cancellation',
        'refund_due_after_cancellation',
      ])
        derived[key] = cancel[key];
      derived.received_amount = snapshot.received_amount;
      derived.retained_amount = snapshot.retained_amount;
    }
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
              label: String(target.guest_name),
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
    if (this.operation === 'cancel') {
      delete i.command.expected_refund_amount;
      delete i.origins.expected_refund_amount;
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
    const ctx = await this.context(i, c),
      target = i.id
        ? await this.store.reservation(c.manager, i.property!, i.id)
        : null;
    if (i.id && !target) throw new NotFoundException('rental:not_found');
    const agreementChange =
      this.operation === 'update' &&
      Object.keys(i.command).some(
        (k) =>
          !['guest_name', 'guest_contact', 'notes', 'is_active'].includes(k),
      );
    const money =
      i.id &&
      (agreementChange || ['confirm', 'cancel'].includes(this.operation))
        ? await this.store.money(c.manager, i.property!, i.id)
        : null;
    const flexible =
      this.operation === 'create' ||
      (target?.status === 'draft' &&
        this.operation === 'update' &&
        (agreementChange
          ? !money?.has_money
          : !(await this.store.hasMoney(c.manager, i.property!, i.id!))));
    if (this.operation === 'create' && !ctx.property.is_active)
      throw new ConflictException('rental:property_inactive');
    if (this.operation === 'update') {
      if (
        !flexible &&
        Object.keys(i.command).some(
          (k) =>
            !['guest_name', 'guest_contact', 'notes', 'is_active'].includes(k),
        )
      )
        throw new ConflictException('rental:agreement_immutable');
      if (
        !ctx.property.is_active &&
        Object.keys(i.command).some(
          (k) =>
            !['guest_name', 'guest_contact', 'notes', 'is_active'].includes(k),
        )
      )
        throw new ConflictException('rental:property_inactive');
    }
    const effective = reservation({
      ...target,
      ...(this.operation === 'create' || this.operation === 'update'
        ? i.command
        : {}),
      property_id: i.property!,
      id: i.id ?? '',
    });
    const calculatedTotal =
      this.operation === 'create' || (this.operation === 'update' && flexible)
        ? validateAgreement(ctx.property, effective)
        : null;
    let policy: NodiaAiJsonObject | null = null;
    if (
      (this.operation === 'create' ||
        (this.operation === 'update' && flexible)) &&
      effective.cancellation_policy_id
    ) {
      policy = await this.store.policy(
        c.manager,
        i.property!,
        effective.cancellation_policy_id,
      );
      if (!policy) throw new NotFoundException('rental:not_found');
      if (!policy.is_active)
        throw new ConflictException('rental:invalid_transition');
      if (this.operation === 'update' && !agreementChange) policy = null;
    }
    const needsCalendar =
      ['confirm', 'cancel'].includes(this.operation) ||
      (agreementChange &&
        ['check_in_on', 'check_out_on', 'check_in_time', 'check_out_time'].some(
          (k) => Object.hasOwn(i.command, k),
        ));
    const calendar = needsCalendar
      ? await this.store.calendar(ctx, effective)
      : null;
    const preparation =
      this.operation === 'start'
        ? await this.store.preparation(ctx, effective)
        : null;
    let cancellation: NodiaAiJsonObject | null = null;
    if (this.operation === 'confirm') {
      assertPhase(effective, ['draft']);
      if (!ctx.property.is_active || !effective.is_active)
        throw new ConflictException('rental:property_inactive');
      validateAgreement(ctx.property, effective);
      if (effective.channel !== 'airbnb') {
        if (i.command.platform_policy !== undefined)
          throw new BadRequestException('rental:invalid_platform_agreement');
        if (
          BigInt(effective.deposit_amount) <= 0n ||
          BigInt(money!.received) < BigInt(effective.deposit_amount)
        )
          throw new ConflictException('rental:deposit_required');
      } else if (!effective.external_reference)
        throw new BadRequestException('rental:invalid_platform_agreement');
      if (calendar!.conflicts.length)
        throw new ConflictException('rental:availability_conflict');
      const approvals = i.command.same_day_approvals as string[];
      const proposed = calendarStay(
        { ...effective, status: 'confirmed' },
        ctx.property.timezone,
      );
      const transitions = [
        { incoming: proposed, previous: calendar!.previous },
        ...(calendar!.next
          ? [{ incoming: calendar!.next, previous: proposed }]
          : []),
      ];
      if (
        approvals.some(
          (id) =>
            !transitions.some(
              (t) =>
                sameDay(t.previous, t.incoming) &&
                calendar!.turnovers.some(
                  (p) =>
                    p.id === id && p.incoming_reservation_id === t.incoming.id,
                ),
            ),
        )
      )
        throw new ConflictException('rental:invalid_approval');
      for (const transition of transitions) {
        const raw = calendar!.turnovers.find(
          (p) => p.incoming_reservation_id === transition.incoming.id,
        );
        if (!raw) throw new ConflictException('rental:turnover_required');
        const original = turnover(raw),
          plan = refreshPlan(original, transition.previous);
        if (approvals.includes(plan.id)) {
          if (
            plan.linen_ready !== true ||
            !planValid(
              plan,
              transition.incoming,
              transition.previous,
              ctx.property.minimum_turnover_minutes,
            )
          )
            throw new ConflictException('rental:turnover_required');
          plan.same_day_approved_at = ctx.now;
        }
        if (
          (transition.incoming.id === effective.id ||
            plan.previous_reservation_id !== original.previous_reservation_id ||
            approvals.includes(plan.id)) &&
          !sameDayValid(
            plan,
            transition.incoming,
            transition.previous,
            ctx.property.minimum_turnover_minutes,
          )
        )
          throw new ConflictException('rental:turnover_required');
      }
      const captured = await capturePolicySnapshot(
        ctx,
        effective,
        i.command.platform_policy as unknown as PlatformPolicyDto | undefined,
      );
      const { captured_at: _captured, ...stable } = captured;
      policy = stable as unknown as NodiaAiJsonObject;
    }
    if (this.operation === 'cancel') {
      const { expected_refund_amount: _expected, ...command } = i.command;
      await validateRentalDto(PreviewRentalCancellationDto, command);
      const preview = await cancellationCalculation(
        ctx,
        effective,
        command as unknown as PreviewRentalCancellationDto,
      );
      const { computed_at: _computed, ...snapshot } =
        preview.cancellation_snapshot;
      const { as_of: _asOf, ...stable } = preview;
      cancellation = {
        ...stable,
        cancellation_snapshot: snapshot,
      } as NodiaAiJsonObject;
      if (
        i.command.expected_refund_amount !== undefined &&
        i.command.expected_refund_amount !== preview.refund_amount
      )
        throw new ConflictException('rental:cancellation_changed');
    }
    if (this.operation === 'start') {
      assertPhase(effective, ['confirmed']);
      if (!ctx.property.is_active)
        throw new ConflictException('rental:property_inactive');
      const stay = calendarStay(effective, ctx.property.timezone),
        raw = preparation!.turnovers.find(
          (t) => t.incoming_reservation_id === i.id,
        );
      const plan = raw ? turnover(raw) : null;
      if (
        ctx.now.getTime() < stay.starts_at ||
        ctx.now.getTime() >= stay.ends_at
      )
        throw new ConflictException('rental:invalid_transition');
      if (
        !plan ||
        plan.previous_reservation_id !== (preparation!.previous?.id ?? null) ||
        !sameDayValid(
          plan,
          stay,
          preparation!.previous,
          ctx.property.minimum_turnover_minutes,
        ) ||
        plan.linen_ready !== true ||
        plan.cleaning_status !== 'completed' ||
        !plan.ready_at ||
        plan.ready_at > ctx.now
      )
        throw new ConflictException('rental:turnover_required');
    }
    if (this.operation === 'complete') {
      assertPhase(effective, ['in_progress']);
      if (
        ctx.now.getTime() <
        calendarStay(effective, ctx.property.timezone).ends_at
      )
        throw new ConflictException('rental:invalid_transition');
    }
    const simpleTransition = ['start', 'complete'].includes(this.operation);
    const metadataUpdate = this.operation === 'update' && !agreementChange;
    const materialTarget =
      target && (simpleTransition || metadataUpdate)
        ? Object.fromEntries(
            Object.entries(target).filter(([key]) =>
              (simpleTransition
                ? [
                    'id',
                    'property_id',
                    'guest_name',
                    'status',
                    'check_in_on',
                    'check_out_on',
                    'check_in_time',
                    'check_out_time',
                  ]
                : ['id', 'property_id', 'guest_name', ...Object.keys(i.command)]
              ).includes(key),
            ),
          )
        : target;
    const materialProperty = Object.fromEntries(
      Object.entries(ctx.property).filter(([key]) =>
        this.operation === 'complete' || metadataUpdate
          ? ['id', 'timezone'].includes(key)
          : this.operation === 'start'
            ? [
                'id',
                'timezone',
                'minimum_turnover_minutes',
                'is_active',
              ].includes(key)
            : true,
      ),
    );
    const result = {
      schema_version: 1,
      property: materialProperty as unknown as NodiaAiJsonObject,
      target: materialTarget,
      money: agreementChange
        ? { has_money: money!.has_money }
        : (money as unknown as NodiaAiJsonObject | null),
      policy,
      calendar: (preparation ??
        calendar) as unknown as NodiaAiJsonObject | null,
      cancellation,
      total_amount:
        this.operation === 'create' || agreementChange ? calculatedTotal : null,
    };
    if (Buffer.byteLength(JSON.stringify(result)) > 262144)
      throw new ConflictException('nodia_ai:result_too_large');
    return result;
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
    if (['start', 'complete'].includes(this.operation))
      assertEmptyCommand(i.command);
    else
      await validateRentalDto(
        dto(this.operation) as new () => object,
        i.command,
      );
    await this.verifyPreconditions(step, c);
    const r = await this.writer(i, c),
      status =
        this.operation === 'create'
          ? 'draft'
          : this.operation === 'confirm'
            ? 'confirmed'
            : this.operation === 'start'
              ? 'in_progress'
              : this.operation === 'complete'
                ? 'completed'
                : this.operation === 'cancel'
                  ? 'cancelled'
                  : r.status;
    if (
      !r ||
      Object.keys(r).sort().join(',') !==
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
      r.operation !== `reservation.${this.operation}` ||
      r.resource_type !== 'reservation' ||
      !isRentalId(r.resource_id) ||
      r.property_id !== i.property ||
      (i.id && r.resource_id !== i.id) ||
      r.status !== status ||
      !['draft', 'confirmed', 'in_progress', 'completed', 'cancelled'].includes(
        r.status,
      ) ||
      !isRentalInstant(r.updated_at)
    )
      throw new InternalServerErrorException('nodia_ai:invalid_output');
    return { id: r.resource_id, propertyId: r.property_id };
  }
}

@Injectable()
export class BuildNodiaAiRentalReservationOperationsUseCase {
  readonly operations: readonly NodiaAiRentalReservationOperation[];
  constructor(
    store: NodiaAiRentalReservationService,
    clock: RentalClock,
    create: CreateRentalReservationUseCase,
    update: UpdateRentalReservationUseCase,
    confirm: ConfirmRentalReservationUseCase,
    start: StartRentalReservationUseCase,
    complete: CompleteRentalReservationUseCase,
    cancel: CancelRentalReservationUseCase,
  ) {
    this.operations = Object.freeze([
      new RentalReservationOperation('create', store, clock, (i, c) =>
        create.execute(
          identity(c),
          i.property!,
          i.command as unknown as CreateRentalReservationDto,
          i.key,
        ),
      ),
      new RentalReservationOperation('update', store, clock, (i, c) =>
        update.execute(
          identity(c),
          i.property!,
          i.id!,
          i.command as UpdateRentalReservationDto,
          i.key,
        ),
      ),
      new RentalReservationOperation('confirm', store, clock, (i, c) =>
        confirm.execute(
          identity(c),
          i.property!,
          i.id!,
          i.command as ConfirmRentalReservationDto,
          i.key,
        ),
      ),
      new RentalReservationOperation('start', store, clock, (i, c) =>
        start.execute(identity(c), i.property!, i.id!, {}, i.key),
      ),
      new RentalReservationOperation('complete', store, clock, (i, c) =>
        complete.execute(identity(c), i.property!, i.id!, {}, i.key),
      ),
      new RentalReservationOperation('cancel', store, clock, (i, c) =>
        cancel.execute(
          identity(c),
          i.property!,
          i.id!,
          i.command as unknown as CancelRentalReservationDto,
          i.key,
        ),
      ),
    ]);
  }
}
