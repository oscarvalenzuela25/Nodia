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
import {
  CreateRentalBlockDto,
  UpdateRentalBlockDto,
} from '../../rental-block/dto/rental-block.dto.js';
import { CreateRentalBlockUseCase } from '../../rental-block/use-case/create-rental-block.use-case.js';
import { UpdateRentalBlockUseCase } from '../../rental-block/use-case/update-rental-block.use-case.js';
import { UpdateRentalTurnoverDto } from '../../rental-turnover/dto/update-rental-turnover.dto.js';
import { UpdateRentalTurnoverUseCase } from '../../rental-turnover/use-case/update-rental-turnover.use-case.js';
import { ApproveSameDayRentalTurnoverUseCase } from '../../rental-turnover/use-case/approve-same-day-rental-turnover.use-case.js';
import {
  applyRentalTurnoverUpdate,
  approveRentalTurnoverSameDay,
} from '../../rental-turnover/types/rental-turnover.rules.js';
import type { RentalTurnover } from '../../rental-turnover/entities/rental-turnover.entity.js';
import type { RentalProperty } from '../../rental-property/entities/rental-property.entity.js';
import { EmptyRentalCommandDto } from '../../rental-reservation/dto/reservation-commands.dto.js';
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
import { NodiaAiRentalOperationsService } from '../nodia-ai-rental-operations.service.js';
import type {
  NodiaAiRentalAction,
  NodiaAiRentalOperation,
  NodiaAiRentalResource,
} from '../types/rental-operation.types.js';

const route = '/reservations';
interface Input {
  property?: string;
  id?: string;
  key: string;
  command: NodiaAiJsonObject;
  origins: NodiaAiJsonObject;
}
type Writer = (i: Input, c: ProposalPreparerContext) => Promise<MutationResult>;
const blockFields = {
  starts_at: 'instant',
  ends_at: 'instant',
  reason: 'string',
  notes: 'nullable_string',
  is_active: 'boolean',
};
const turnoverFields = {
  linen_ready: 'nullable_boolean',
  cleaning_status: 'enum',
  planned_ready_at: 'nullable_instant',
  ready_at: 'nullable_instant',
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
function projection(raw: NodiaAiJsonObject): NodiaAiJsonObject {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      key.endsWith('_at') && typeof value === 'string'
        ? new Date(value).toISOString()
        : value,
    ]),
  );
}
function materialTarget(
  raw: NodiaAiJsonObject,
  command: NodiaAiJsonObject,
): NodiaAiJsonObject {
  const projected = projection(raw);
  if (!Object.hasOwn(command, 'notes')) delete projected.notes;
  return projected;
}
const identity = (c: ProposalPreparerContext) => ({
  userId: c.actor.actorId,
  sessionId: c.actor.sessionId,
  transaction: c.manager,
  statementTimeoutMs: c.statementTimeoutMs,
});
function turnover(raw: NodiaAiJsonObject): RentalTurnover {
  return {
    ...raw,
    ...Object.fromEntries(
      ['planned_ready_at', 'ready_at', 'same_day_approved_at'].map((key) => [
        key,
        raw[key] === null ? null : new Date(String(raw[key])),
      ]),
    ),
  } as unknown as RentalTurnover;
}

class RentalOperation implements NodiaAiRentalOperation {
  readonly toolName: string;
  readonly catalogVersion = 'nodia-ai-ai26-rental-operations/1';
  readonly moduleRoutes = [route];
  readonly actionKeys: readonly string[] = [];
  readonly bindableFields: Readonly<Record<string, string>> = {};
  readonly outputKeys: Readonly<Record<string, string>>;
  readonly editableFields: Readonly<Record<string, string>>;
  readonly reviewFields: readonly NodiaAiProposalReviewField[];
  readonly contractHash: string;
  constructor(
    readonly resourceKey: NodiaAiRentalResource,
    readonly operation: NodiaAiRentalAction,
    private readonly store: NodiaAiRentalOperationsService,
    private readonly clock: RentalClock,
    private readonly writer: Writer,
  ) {
    this.toolName = `nodia_${resourceKey}_prepare_${operation}`;
    this.outputKeys = {
      id:
        resourceKey === 'rental_blocks'
          ? 'rental_block_id'
          : 'rental_turnover_id',
    };
    this.editableFields =
      operation === 'approve_same_day'
        ? {}
        : resourceKey === 'rental_blocks'
          ? blockFields
          : turnoverFields;
    this.reviewFields = Object.entries(this.editableFields).map(
      ([field_key, type]) => ({
        field_key,
        label_key: `nodiaAi:proposal.rental_fields.${field_key}`,
        kind: type.includes('boolean')
          ? 'boolean'
          : type === 'enum'
            ? 'enum'
            : 'text',
        nullable: type.startsWith('nullable_'),
        max_length:
          field_key === 'notes' ? 5000 : field_key === 'reason' ? 255 : null,
        minimum: null,
        maximum: null,
        options:
          field_key === 'cleaning_status'
            ? ['pending', 'in_progress', 'completed'].map((value) => ({
                value,
                label_key: `nodiaAi:proposal.rental_values.cleaning_status.${value}`,
              }))
            : [],
      }),
    );
    this.contractHash = createHash('sha256')
      .update(
        JSON.stringify({
          version: this.catalogVersion,
          resource: resourceKey,
          operation,
          fields: this.editableFields,
          template: 1,
          snapshot: 'locked-house-material-target-transition-block-impact/1',
          preview: 'native-pure-turnover-rules/1',
          request_key: 'backend_uuid_v4_fixed_intent/1',
        }),
      )
      .digest('hex');
  }
  private dto(): new () => object {
    return this.operation === 'approve_same_day'
      ? EmptyRentalCommandDto
      : this.resourceKey === 'rental_turnovers'
        ? UpdateRentalTurnoverDto
        : this.operation === 'create'
          ? CreateRentalBlockDto
          : UpdateRentalBlockDto;
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
      : ['property_id', 'id', ...Object.keys(this.editableFields)];
    if (
      Object.keys(raw).some((key) => !allowed.includes(key)) ||
      (stored && raw.schema_version !== 1)
    )
      return invalid();
    if (
      (raw.property_id !== undefined && !isRentalId(raw.property_id)) ||
      (raw.id !== undefined && !isRentalId(raw.id)) ||
      (this.operation === 'create' && raw.id !== undefined)
    )
      return invalid();
    const input = stored
      ? { ...object(raw.command) }
      : Object.fromEntries(
          Object.entries(raw).filter(
            ([key]) => !['property_id', 'id'].includes(key),
          ),
        );
    const origins = stored
      ? { ...object(raw.origins) }
      : Object.fromEntries(Object.keys(input).map((key) => [key, 'user']));
    if (
      Object.keys(input).some(
        (key) =>
          !Object.hasOwn(this.editableFields, key) || input[key] === undefined,
      ) ||
      Object.keys(origins).length !== Object.keys(input).length ||
      Object.keys(input).some((key) => !Object.hasOwn(origins, key)) ||
      Object.values(origins).some(
        (v) => !['user', 'database', 'contract_default'].includes(String(v)),
      )
    )
      return invalid();
    if (Buffer.byteLength(JSON.stringify(input)) > 65536)
      throw new ConflictException('nodia_ai:result_too_large');
    const dto = plainToInstance(this.dto(), input);
    if (this.operation === 'approve_same_day') assertEmptyCommand(input);
    else if (
      validateSync(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
        skipMissingProperties: true,
      }).length
    )
      return invalid();
    const normalized = Object.fromEntries(
      Object.keys(input).map((key) => [key, (dto as NodiaAiJsonObject)[key]]),
    );
    return {
      property: raw.property_id as string | undefined,
      id: raw.id as string | undefined,
      key: stored ? requireRequestKey(raw.request_key) : randomUUID(),
      command: canonicalRentalCommand(normalized) as NodiaAiJsonObject,
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
    const i = this.decode(raw),
      old = previous ? this.decode(previous, true) : null;
    if (old) {
      if (
        (i.property && old.property && i.property !== old.property) ||
        (i.id && old.id && i.id !== old.id)
      )
        return invalid();
      i.property ??= old.property;
      i.id ??= old.id;
      i.key = old.key;
      i.command = { ...old.command, ...i.command };
      i.origins = { ...old.origins, ...i.origins };
    }
    return this.prepareInput(i, c);
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
      for (const key of ['starts_at', 'ends_at', 'reason'])
        if (!Object.hasOwn(i.command, key)) missing.push(key);
    if (this.operation === 'update' && !Object.keys(i.command).length)
      missing.push('changes');
    if (missing.length)
      return {
        status: 'needs_clarification',
        partial: this.template(i),
        missingFields: missing,
        clarificationKeys: missing.map(
          (key) => `nodia_ai:rental_${key}_required`,
        ),
      };
    if (this.operation === 'create')
      for (const [key, value] of Object.entries({
        notes: null,
        is_active: true,
      }))
        if (!Object.hasOwn(i.command, key)) {
          i.command[key] = value;
          i.origins[key] = 'contract_default';
        }
    if (this.operation === 'approve_same_day') assertEmptyCommand(i.command);
    else await validateRentalDto(this.dto(), i.command);
    const preconditions = await this.snapshot(i, c);
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
    for (const [field_key, value] of Object.entries(
      object(preconditions.derived),
    )) {
      if (Object.hasOwn(i.command, field_key)) continue;
      changes.push({
        field_key,
        before: target ? review(target[field_key] ?? null) : null,
        before_present: target !== null,
        after: review(value),
        after_present: true,
        origin: 'database',
      });
    }
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
              label:
                this.resourceKey === 'rental_blocks'
                  ? String(target.reason)
                  : i.id!,
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
    let result: NodiaAiJsonObject;
    if (this.resourceKey === 'rental_blocks') {
      const target = i.id
        ? await this.store.block(c.manager, i.property!, i.id)
        : null;
      if (i.id && !target) throw new NotFoundException('rental:not_found');
      const normalizedTarget = target
        ? materialTarget(target, i.command)
        : null;
      const effective = { ...normalizedTarget, ...i.command },
        starts = new Date(String(effective.starts_at)),
        ends = new Date(String(effective.ends_at));
      if (ends <= starts) throw new BadRequestException('rental:invalid_input');
      const calendarChanged =
        !normalizedTarget ||
        ['starts_at', 'ends_at', 'is_active'].some(
          (key) => effective[key] !== normalizedTarget[key],
        );
      if (
        !ctx.property.is_active &&
        (this.operation === 'create' ||
          (calendarChanged && effective.is_active))
      )
        throw new ConflictException('rental:invalid_transition');
      const impact =
        effective.is_active && calendarChanged
          ? (await this.store.blockImpact(ctx, starts, ends, i.id)).map(
              (plan) =>
                projection(
                  Object.fromEntries(
                    Object.entries(plan).filter(([key]) =>
                      [
                        'id',
                        'cleaning_status',
                        'planned_ready_at',
                        'ready_at',
                        'same_day_approved_at',
                      ].includes(key),
                    ),
                  ),
                ),
            )
          : null;
      result = {
        schema_version: 1,
        property: {
          id: ctx.property.id,
          ...(calendarChanged
            ? {
                is_active: ctx.property.is_active,
                timezone: ctx.property.timezone,
              }
            : {}),
        },
        target: normalizedTarget,
        impact,
        derived: {
          timezone: ctx.property.timezone,
          ...(impact ? { affected_turnover_ids: impact.map((p) => p.id) } : {}),
        },
      };
    } else {
      const target = await this.store.turnover(c.manager, i.property!, i.id!);
      if (!target) throw new NotFoundException('rental:not_found');
      const transition = await this.store.transition(
        ctx,
        String(target.incoming_reservation_id),
      );
      if (!transition) throw new NotFoundException('rental:not_found');
      const row =
        this.operation === 'approve_same_day'
          ? approveRentalTurnoverSameDay(
              turnover(target),
              transition.incoming,
              transition.previous,
              ctx.property.minimum_turnover_minutes,
              ctx.now,
            )
          : applyRentalTurnoverUpdate(
              turnover(target),
              transition.incoming,
              transition.previous,
              ctx.property.minimum_turnover_minutes,
              ctx.now,
              i.command as UpdateRentalTurnoverDto,
            );
      const derived: NodiaAiJsonObject = { timezone: ctx.property.timezone };
      if (this.operation === 'approve_same_day')
        derived.same_day_approval = true;
      for (const key of [
        'previous_reservation_id',
        'cleaning_status',
        'ready_at',
        'same_day_approved_at',
      ] as const) {
        if (
          this.operation === 'approve_same_day' &&
          key === 'same_day_approved_at'
        )
          continue;
        const after =
          row[key] instanceof Date ? row[key].toISOString() : row[key];
        const before = projection(target)[key];
        if (!isDeepStrictEqual(after, before)) derived[key] = after;
      }
      result = {
        schema_version: 1,
        property: {
          id: ctx.property.id,
          timezone: ctx.property.timezone,
          minimum_turnover_minutes: ctx.property.minimum_turnover_minutes,
        },
        target: materialTarget(target, i.command),
        transition: {
          incoming: {
            id: transition.incoming.id,
            check_in_on: transition.incoming.check_in_on,
            starts_at: transition.incoming.starts_at,
            ...(this.operation === 'approve_same_day'
              ? { approvable: true }
              : {}),
          },
          previous: transition.previous
            ? {
                id: transition.previous.id,
                check_out_on: transition.previous.check_out_on,
                ends_at: transition.previous.ends_at,
              }
            : null,
        },
        derived,
      };
    }
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
    if (this.operation === 'approve_same_day') assertEmptyCommand(i.command);
    else await validateRentalDto(this.dto(), i.command);
    await this.verifyPreconditions(step, c);
    const r = await this.writer(i, c),
      resource = this.resourceKey === 'rental_blocks' ? 'block' : 'turnover';
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
      r.operation !== `${resource}.${this.operation}` ||
      r.resource_type !== resource ||
      !isRentalId(r.resource_id) ||
      r.property_id !== i.property ||
      (i.id && r.resource_id !== i.id) ||
      !(
        resource === 'block'
          ? ['active', 'inactive']
          : ['pending', 'in_progress', 'completed']
      ).includes(r.status) ||
      !isRentalInstant(r.updated_at)
    )
      throw new InternalServerErrorException('nodia_ai:invalid_output');
    return { id: r.resource_id, propertyId: r.property_id };
  }
}

@Injectable()
export class BuildNodiaAiRentalOperationsUseCase {
  readonly operations: readonly NodiaAiRentalOperation[];
  constructor(
    store: NodiaAiRentalOperationsService,
    clock: RentalClock,
    createBlock: CreateRentalBlockUseCase,
    updateBlock: UpdateRentalBlockUseCase,
    updateTurnover: UpdateRentalTurnoverUseCase,
    approveSameDay: ApproveSameDayRentalTurnoverUseCase,
  ) {
    this.operations = Object.freeze([
      new RentalOperation('rental_blocks', 'create', store, clock, (i, c) =>
        createBlock.execute(
          identity(c),
          i.property!,
          i.command as unknown as CreateRentalBlockDto,
          i.key,
        ),
      ),
      new RentalOperation('rental_blocks', 'update', store, clock, (i, c) =>
        updateBlock.execute(
          identity(c),
          i.property!,
          i.id!,
          i.command as UpdateRentalBlockDto,
          i.key,
        ),
      ),
      new RentalOperation('rental_turnovers', 'update', store, clock, (i, c) =>
        updateTurnover.execute(
          identity(c),
          i.property!,
          i.id!,
          i.command as UpdateRentalTurnoverDto,
          i.key,
        ),
      ),
      new RentalOperation(
        'rental_turnovers',
        'approve_same_day',
        store,
        clock,
        (i, c) =>
          approveSameDay.execute(identity(c), i.property!, i.id!, {}, i.key),
      ),
    ]);
  }
}
