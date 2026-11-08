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
import { CreateRentalPropertyDto } from '../../rental-property/dto/create-rental-property.dto.js';
import { UpdateRentalPropertyDto } from '../../rental-property/dto/update-rental-property.dto.js';
import { CreateRentalCollaboratorDto } from '../../rental-collaborator/dto/create-rental-collaborator.dto.js';
import { UpdateRentalCollaboratorDto } from '../../rental-collaborator/dto/update-rental-collaborator.dto.js';
import {
  CreateRentalCancellationPolicyDto,
  RentalCancellationRuleDto,
} from '../../rental-cancellation-policy/dto/create-rental-cancellation-policy.dto.js';
import { UpdateRentalCancellationPolicyDto } from '../../rental-cancellation-policy/dto/update-rental-cancellation-policy.dto.js';
import { CreateRentalPropertyUseCase } from '../../rental-property/use-case/create-rental-property.use-case.js';
import { UpdateRentalPropertyUseCase } from '../../rental-property/use-case/update-rental-property.use-case.js';
import { CreateRentalCollaboratorUseCase } from '../../rental-collaborator/use-case/create-rental-collaborator.use-case.js';
import { UpdateRentalCollaboratorUseCase } from '../../rental-collaborator/use-case/update-rental-collaborator.use-case.js';
import { CreateRentalCancellationPolicyUseCase } from '../../rental-cancellation-policy/use-case/create-rental-cancellation-policy.use-case.js';
import { UpdateRentalCancellationPolicyUseCase } from '../../rental-cancellation-policy/use-case/update-rental-cancellation-policy.use-case.js';
import {
  isRentalId,
  normalizePercent,
  validateRentalDto,
} from '../../rental-common/rental-validation.js';
import { requireRequestKey } from '../../rental-common/rental-transaction.service.js';
import { isRentalInstant } from '../../rental-common/rental-time.js';
import { normalizedCancellationRules } from '../../rental-cancellation-policy/types/rental-cancellation-policy.types.js';
import type { MutationResult } from '../../rental-common/types/rental.types.js';
import { NodiaAiRentalConfigurationService } from '../nodia-ai-rental-configuration.service.js';
import type {
  NodiaAiRentalConfigurationOperation,
  NodiaAiRentalConfigurationResource,
} from '../types/rental-configuration-operation.types.js';

const route = '/reservations';
type Resource = NodiaAiRentalConfigurationResource;
type Operation = 'create' | 'update';
interface Input {
  property?: string;
  id?: string;
  key: string;
  command: NodiaAiJsonObject;
  origins: NodiaAiJsonObject;
}
type Writer = (
  input: Input,
  ctx: ProposalPreparerContext,
) => Promise<MutationResult>;
const propertyFields: Readonly<Record<string, string>> = {
  name: 'string',
  timezone: 'timezone',
  max_guests: 'integer',
  check_in_time: 'local_time',
  check_out_time: 'local_time',
  location: 'nullable_string',
  default_nightly_rate: 'nullable_positive_money',
  default_deposit_percent: 'nullable_percent',
  minimum_turnover_minutes: 'integer',
  notes: 'nullable_string',
  is_active: 'boolean',
};
const collaboratorFields: Readonly<Record<string, string>> = {
  position: 'nullable_string',
  is_active: 'boolean',
};
const policyFields: Readonly<Record<string, string>> = {
  name: 'string',
  is_active: 'boolean',
  rules: 'rental_cancellation_rules',
};
const invalid = (): never => {
  throw new BadRequestException('nodia_ai:invalid_input');
};
const object = (value: unknown): NodiaAiJsonObject => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid();
  return value as NodiaAiJsonObject;
};
function review(value: NodiaAiJsonValue): NodiaAiJsonValue {
  if (Array.isArray(value)) return { kind: 'array', items: value.map(review) };
  if (value !== null && typeof value === 'object')
    return {
      kind: 'object',
      fields: Object.entries(value).map(([field_key, item]) => ({
        field_key,
        value: review(item),
      })),
    };
  return value;
}
const identity = (ctx: ProposalPreparerContext) => ({
  userId: ctx.actor.actorId,
  sessionId: ctx.actor.sessionId,
  transaction: ctx.manager,
  statementTimeoutMs: ctx.statementTimeoutMs,
});

class RentalConfigurationOperation implements NodiaAiRentalConfigurationOperation {
  readonly toolName: string;
  readonly catalogVersion = 'nodia-ai-ai24-rental-configuration/1';
  readonly moduleRoutes = [route];
  readonly actionKeys: readonly string[] = [];
  readonly bindableFields: Readonly<Record<string, string>> = {};
  readonly editableFields: Readonly<Record<string, string>>;
  readonly outputKeys: Readonly<Record<string, string>>;
  readonly reviewFields: readonly NodiaAiProposalReviewField[];
  readonly contractHash: string;
  constructor(
    readonly resourceKey: Resource,
    readonly operation: Operation,
    private readonly store: NodiaAiRentalConfigurationService,
    private readonly writer: Writer,
  ) {
    this.toolName = `nodia_${resourceKey}_prepare_${operation}`;
    this.editableFields =
      resourceKey === 'rental_properties'
        ? {
            ...propertyFields,
            ...(operation === 'create'
              ? { owner_id: 'user_id' }
              : { default_cancellation_policy_id: 'nullable_policy_id' }),
          }
        : resourceKey === 'rental_collaborators'
          ? {
              ...collaboratorFields,
              ...(operation === 'create' ? { user_id: 'user_id' } : {}),
            }
          : policyFields;
    this.outputKeys = {
      id:
        resourceKey === 'rental_properties'
          ? 'rental_property_id'
          : resourceKey === 'rental_collaborators'
            ? 'rental_collaborator_id'
            : 'rental_cancellation_policy_id',
    };
    this.reviewFields = Object.keys(this.editableFields)
      .filter((field_key) => field_key !== 'owner_id')
      .map((field_key) => ({
        field_key,
        label_key: `nodiaAi:proposal.rental_fields.${field_key}`,
        kind:
          field_key === 'rules'
            ? 'rental_cancellation_rules'
            : field_key === 'is_active'
              ? 'boolean'
              : ['max_guests', 'minimum_turnover_minutes'].includes(field_key)
                ? 'integer'
                : [
                      'owner_id',
                      'user_id',
                      'default_cancellation_policy_id',
                      'default_nightly_rate',
                    ].includes(field_key)
                  ? 'bigint'
                  : 'text',
        nullable:
          [
            'location',
            'notes',
            'position',
            'default_nightly_rate',
            'default_deposit_percent',
            'default_cancellation_policy_id',
          ].includes(field_key) ||
          (operation === 'create' &&
            ['check_in_time', 'check_out_time'].includes(field_key)),
        max_length:
          field_key === 'notes'
            ? 5000
            : field_key === 'location'
              ? 500
              : field_key === 'name' || field_key === 'position'
                ? 255
                : field_key === 'timezone'
                  ? 64
                  : field_key === 'default_deposit_percent'
                    ? 6
                    : field_key.endsWith('_time')
                      ? 5
                      : null,
        minimum:
          field_key === 'rules' ||
          field_key === 'max_guests' ||
          [
            'owner_id',
            'user_id',
            'default_cancellation_policy_id',
            'default_nightly_rate',
          ].includes(field_key)
            ? '1'
            : field_key === 'minimum_turnover_minutes'
              ? '0'
              : null,
        maximum:
          field_key === 'rules'
            ? '100'
            : field_key === 'max_guests'
              ? '1000'
              : field_key === 'minimum_turnover_minutes'
                ? '10080'
                : [
                      'owner_id',
                      'user_id',
                      'default_cancellation_policy_id',
                      'default_nightly_rate',
                    ].includes(field_key)
                  ? '9223372036854775807'
                  : null,
        options: [],
      }));
    this.contractHash = createHash('sha256')
      .update(
        JSON.stringify({
          version: 'ai24-rental-configuration/1',
          resourceKey,
          operation,
          fields: this.editableFields,
          template: 1,
          preconditions:
            'locked-owner-target-rules-references-exact-timestamp/1',
          requestKey: 'backend_uuid_v4_fixed_per_intent/1',
          archive: 'native-is_active-preserves-history/1',
          timezone: 'native-deployment-default-resolved-before-preview/1',
        }),
      )
      .digest('hex');
  }
  private dto() {
    return this.resourceKey === 'rental_properties'
      ? this.operation === 'create'
        ? CreateRentalPropertyDto
        : UpdateRentalPropertyDto
      : this.resourceKey === 'rental_collaborators'
        ? this.operation === 'create'
          ? CreateRentalCollaboratorDto
          : UpdateRentalCollaboratorDto
        : this.operation === 'create'
          ? CreateRentalCancellationPolicyDto
          : UpdateRentalCancellationPolicyDto;
  }
  private decode(raw: NodiaAiJsonObject, stored = false): Input {
    if (
      Object.keys(raw).some(
        (k) =>
          !(
            stored
              ? [
                  'schema_version',
                  'property_id',
                  'id',
                  'request_key',
                  'command',
                  'origins',
                ]
              : ['property_id', 'id', ...Object.keys(this.editableFields)]
          ).includes(k),
      ) ||
      (stored && raw.schema_version !== 1)
    )
      return invalid();
    let property = raw.property_id,
      id = raw.id;
    if (
      (property !== undefined && !isRentalId(property)) ||
      (id !== undefined && !isRentalId(id)) ||
      (this.operation === 'create' && id !== undefined) ||
      (this.resourceKey === 'rental_properties' &&
        this.operation === 'create' &&
        property !== undefined)
    )
      return invalid();
    if (
      this.resourceKey === 'rental_properties' &&
      this.operation === 'update' &&
      property !== undefined
    ) {
      if (id !== undefined && id !== property) return invalid();
      id = property;
    }
    const command = stored
      ? { ...object(raw.command) }
      : Object.fromEntries(
          Object.entries(raw).filter(
            ([k]) => k !== 'id' && k !== 'property_id',
          ),
        );
    const origins = stored
      ? { ...object(raw.origins) }
      : Object.fromEntries(Object.keys(command).map((k) => [k, 'user']));
    if (
      Object.keys(command).some(
        (k) =>
          !Object.hasOwn(this.editableFields, k) || command[k] === undefined,
      ) ||
      Object.keys(origins).length !== Object.keys(command).length ||
      Object.keys(command).some((k) => !Object.hasOwn(origins, k)) ||
      Object.values(origins).some(
        (v) =>
          typeof v !== 'string' ||
          !['user', 'database', 'contract_default', 'backend'].includes(v),
      )
    )
      return invalid();
    if (Buffer.byteLength(JSON.stringify(command)) > 65536)
      throw new ConflictException('nodia_ai:result_too_large');
    const dto = plainToInstance(this.dto() as new () => object, command);
    if (
      validateSync(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
        skipUndefinedProperties: true,
      }).length
    )
      return invalid();
    for (const key of Object.keys(command))
      command[key] = (dto as NodiaAiJsonObject)[key];
    if (command.default_deposit_percent != null)
      command.default_deposit_percent = normalizePercent(
        String(command.default_deposit_percent),
      );
    if (command.rules !== undefined) {
      if (!Array.isArray(command.rules)) return invalid();
      const rules = command.rules.map((rule) => {
        const dto = plainToInstance(RentalCancellationRuleDto, object(rule));
        if (
          validateSync(dto, {
            whitelist: true,
            forbidNonWhitelisted: true,
            forbidUnknownValues: true,
          }).length
        )
          return invalid();
        return dto;
      });
      command.rules = normalizedCancellationRules(rules).map((r) => ({ ...r }));
    }
    const key = stored ? requireRequestKey(raw.request_key) : randomUUID();
    return {
      property: property as string | undefined,
      id: id as string | undefined,
      key,
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
    return i.property
      ? { property_id: i.property }
      : { subject_user_id: i.command.owner_id ?? null };
  }
  private async authority(ctx: ProposalPreparerContext) {
    if (
      !ctx.manager.queryRunner?.isTransactionActive ||
      !ctx.moduleRoutes.includes(route)
    )
      throw new ForbiddenException('nodia_ai:capability_denied');
    await lockAuthority(ctx.manager, false, ctx.statementTimeoutMs);
    return currentActor(ctx.manager, identity(ctx));
  }
  async prepare(
    partial: NodiaAiJsonObject,
    ctx: ProposalPreparerContext,
    previous?: NodiaAiJsonObject,
  ): Promise<ProposalPreparation> {
    const next = this.decode(partial),
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
    return this.prepareInput(next, ctx);
  }
  reprepareStored(template: NodiaAiJsonObject, ctx: ProposalPreparerContext) {
    return this.prepareInput(this.decode(template, true), ctx);
  }
  private async prepareInput(
    input: Input,
    ctx: ProposalPreparerContext,
  ): Promise<ProposalPreparation> {
    const actor = await this.authority(ctx),
      missing: string[] = [];
    if (
      !(
        this.resourceKey === 'rental_properties' && this.operation === 'create'
      ) &&
      !input.property
    )
      missing.push('property_id');
    if (this.operation === 'update' && !input.id) missing.push('id');
    if (this.operation === 'create') {
      const required =
        this.resourceKey === 'rental_properties'
          ? ['name', 'max_guests']
          : this.resourceKey === 'rental_collaborators'
            ? ['user_id']
            : ['name', 'rules'];
      for (const key of required)
        if (!Object.hasOwn(input.command, key)) missing.push(key);
      if (this.resourceKey === 'rental_properties') {
        if (input.command.owner_id === undefined) {
          input.command.owner_id = actor.actorId;
          input.origins.owner_id = 'database';
        }
        if (input.command.owner_id !== actor.actorId && !actor.isSuperAdmin)
          throw new ForbiddenException('rental:owner_required');
      }
    } else if (!Object.keys(input.command).length) missing.push('changes');
    if (missing.length)
      return {
        status: 'needs_clarification',
        partial: this.template(input),
        missingFields: missing,
        clarificationKeys: missing.map((k) => `nodia_ai:rental_${k}_required`),
      };
    const defaults: NodiaAiJsonObject =
      this.operation !== 'create'
        ? {}
        : this.resourceKey === 'rental_properties'
          ? {
              timezone:
                process.env.RENTAL_DEFAULT_TIMEZONE ?? 'America/Santiago',
              check_in_time: null,
              check_out_time: null,
              location: null,
              default_nightly_rate: null,
              default_deposit_percent: null,
              minimum_turnover_minutes: 0,
              notes: null,
              is_active: true,
            }
          : this.resourceKey === 'rental_collaborators'
            ? { position: null, is_active: true }
            : { is_active: true };
    for (const [key, value] of Object.entries(defaults))
      if (!Object.hasOwn(input.command, key)) {
        input.command[key] = value;
        input.origins[key] = 'contract_default';
      }
    input = this.decode(this.template(input), true);
    await validateRentalDto(this.dto() as new () => object, input.command);
    const preconditions = await this.snapshot(input, ctx, actor);
    const target =
      preconditions.target === null ? null : object(preconditions.target);
    const changes = Object.entries(input.command).map(([field_key, value]) => ({
      field_key,
      before: target
        ? review(
            field_key === 'rules' && Array.isArray(target.rules)
              ? target.rules.map((rule) => {
                  const row = object(rule);
                  return {
                    min_days_before: row.min_days_before,
                    refund_percent: row.refund_percent,
                  };
                })
              : (target[field_key] ?? null),
          )
        : null,
      before_present: target !== null,
      after: review(value),
      after_present: true,
      origin: input.origins[field_key],
    }));
    const scope = this.scope(input);
    return {
      status: 'ready',
      commandTemplate: this.template(input),
      scope,
      preconditions,
      publicStep: {
        tool_name: this.toolName,
        kind: 'domain_change',
        target: target
          ? {
              resource_key: this.resourceKey,
              id: input.id!,
              label: String(target.name ?? target.user_id),
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
    ctx: ProposalPreparerContext,
  ) {
    const input = this.decode(template, true),
      seen = new Set<string>();
    for (const edit of edits) {
      if (
        !Object.hasOwn(this.editableFields, edit.field_key) ||
        seen.has(edit.field_key)
      )
        return invalid();
      seen.add(edit.field_key);
      input.command[edit.field_key] = edit.value;
      input.origins[edit.field_key] = 'user';
    }
    const normalized = this.decode(this.template(input), true);
    await this.authority(ctx);
    return this.template(normalized);
  }
  async verifyAuthority(
    step: StoredProposalStep,
    ctx: ProposalPreparerContext,
  ) {
    const input = this.decode(step.commandTemplate, true);
    if (
      step.toolName !== this.toolName ||
      step.contractHash !== this.contractHash ||
      !isDeepStrictEqual(step.scope, this.scope(input))
    )
      throw new ForbiddenException('nodia_ai:capability_denied');
    const actor = await this.authority(ctx);
    await this.authorizedProperty(input, ctx, actor);
  }
  async verifyPreconditions(
    step: StoredProposalStep,
    ctx: ProposalPreparerContext,
  ) {
    await this.verifyAuthority(step, ctx);
    try {
      const actor = await this.authority(ctx);
      if (
        !isDeepStrictEqual(
          await this.snapshot(
            this.decode(step.commandTemplate, true),
            ctx,
            actor,
          ),
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
  private async authorizedProperty(
    input: Input,
    ctx: ProposalPreparerContext,
    actor: Awaited<ReturnType<typeof currentActor>>,
  ) {
    if (
      this.resourceKey === 'rental_properties' &&
      this.operation === 'create'
    ) {
      if (input.command.owner_id !== actor.actorId && !actor.isSuperAdmin)
        throw new ForbiddenException('rental:owner_required');
      return null;
    }
    if (!input.property) return invalid();
    const property = await this.store.property(ctx.manager, input.property);
    if (!property) throw new NotFoundException('rental:not_found');
    if (property.owner_id !== actor.actorId && !actor.isSuperAdmin) {
      const membership = await this.store.membership(
        ctx.manager,
        input.property,
        actor.actorId,
      );
      if (!membership?.is_active)
        throw new NotFoundException('rental:not_found');
      throw new ForbiddenException('rental:owner_required');
    }
    return property;
  }
  private async snapshot(
    input: Input,
    ctx: ProposalPreparerContext,
    actor: Awaited<ReturnType<typeof currentActor>>,
  ): Promise<NodiaAiJsonObject> {
    const property = await this.authorizedProperty(input, ctx, actor);
    let target: NodiaAiJsonObject | null = null,
      user: NodiaAiJsonObject | null = null,
      policy: NodiaAiJsonObject | null = null,
      references: NodiaAiJsonObject | null = null;
    if (!property) {
      user = await this.store.user(ctx.manager, String(input.command.owner_id));
      if (!user?.is_active) throw new NotFoundException('rental:not_found');
    } else {
      if (this.resourceKey === 'rental_properties') target = property;
      else if (this.operation === 'update')
        target =
          this.resourceKey === 'rental_collaborators'
            ? await this.store.collaborator(
                ctx.manager,
                input.property!,
                input.id!,
              )
            : await this.store.policy(ctx.manager, input.property!, input.id!);
      if (this.operation === 'update' && !target)
        throw new NotFoundException('rental:not_found');
      if (this.operation === 'create' && !property.is_active)
        throw new ConflictException('rental:invalid_transition');
      if (this.resourceKey === 'rental_collaborators') {
        const userId =
          this.operation === 'create'
            ? String(input.command.user_id)
            : String(target!.user_id);
        if (
          this.operation === 'create' ||
          (input.command.is_active === true && target?.is_active === false)
        ) {
          if (!property.is_active || userId === property.owner_id)
            throw new ConflictException('rental:invalid_transition');
          user = await this.store.user(ctx.manager, userId);
          if (!user?.is_active) throw new NotFoundException('rental:not_found');
        }
        if (
          this.operation === 'create' &&
          (await this.store.membership(ctx.manager, input.property!, userId))
        )
          throw new ConflictException('rental:invalid_transition');
      }
      if (
        this.resourceKey === 'rental_cancellation_policies' &&
        input.command.is_active === false &&
        property.default_cancellation_policy_id === input.id
      )
        throw new ConflictException('rental:invalid_transition');
      const effectivePolicy =
        input.command.default_cancellation_policy_id === undefined
          ? property.default_cancellation_policy_id
          : input.command.default_cancellation_policy_id;
      if (this.resourceKey === 'rental_properties' && effectivePolicy != null) {
        policy = await this.store.policy(
          ctx.manager,
          input.property!,
          String(effectivePolicy),
        );
        if (!policy) throw new NotFoundException('rental:not_found');
        if (
          input.command.default_cancellation_policy_id != null &&
          !policy.is_active
        )
          throw new ConflictException('rental:invalid_transition');
      }
      if (
        this.resourceKey === 'rental_properties' &&
        ['timezone', 'max_guests', 'minimum_turnover_minutes'].some((k) =>
          Object.hasOwn(input.command, k),
        )
      ) {
        references = await this.store.configurationReferences(
          ctx.manager,
          input.property!,
          ctx.maxCollectionItems ?? 128,
        );
        if (
          input.command.timezone !== undefined &&
          input.command.timezone !== property.timezone &&
          references.has_history
        )
          throw new ConflictException('rental:agreement_immutable');
        if (
          typeof input.command.max_guests === 'number' &&
          input.command.max_guests < Number(property.max_guests) &&
          input.command.max_guests < Number(references.max_guests)
        )
          throw new ConflictException('rental:invalid_transition');
        if (
          typeof input.command.minimum_turnover_minutes === 'number' &&
          input.command.minimum_turnover_minutes >
            Number(property.minimum_turnover_minutes)
        ) {
          const minimumMs = input.command.minimum_turnover_minutes * 60000;
          for (const entry of references.turnovers as NodiaAiJsonObject[]) {
            const earliest =
              new Date(String(entry.previous_out)).getTime() + minimumMs;
            const incoming = new Date(String(entry.incoming_at)).getTime(),
              ready =
                entry.planned_ready_at === null
                  ? NaN
                  : new Date(String(entry.planned_ready_at)).getTime();
            if (
              !entry.linen_ready ||
              !Number.isFinite(ready) ||
              incoming < earliest ||
              ready < earliest ||
              ready > incoming
            )
              throw new ConflictException('rental:turnover_required');
          }
        }
      }
    }
    const result = {
      schema_version: 1,
      property,
      target,
      user,
      policy,
      references,
    };
    if (Buffer.byteLength(JSON.stringify(result)) > 262144)
      throw new ConflictException('nodia_ai:result_too_large');
    return result;
  }
  async executeConfirmed(
    step: StoredProposalStep,
    ctx: ProposalPreparerContext,
  ) {
    const input = this.decode(step.commandTemplate, true);
    if (
      !isDeepStrictEqual(this.template(input), step.commandTemplate) ||
      step.outputBindings.length ||
      !Array.isArray(step.publicStep.depends_on) ||
      step.publicStep.depends_on.length
    )
      return invalid();
    await validateRentalDto(this.dto() as new () => object, input.command);
    await this.verifyPreconditions(step, ctx);
    const result = await this.writer(input, ctx),
      kind =
        this.resourceKey === 'rental_properties'
          ? 'property'
          : this.resourceKey === 'rental_collaborators'
            ? 'collaborator'
            : 'policy';
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
      !isRentalId(result.resource_id) ||
      !isRentalId(result.property_id) ||
      result.operation !== `${kind}.${this.operation}` ||
      result.resource_type !== kind ||
      !['active', 'inactive'].includes(result.status) ||
      !isRentalInstant(result.updated_at) ||
      (this.resourceKey === 'rental_properties' &&
        result.property_id !== result.resource_id) ||
      (input.property && result.property_id !== input.property) ||
      (input.id && result.resource_id !== input.id)
    )
      throw new InternalServerErrorException('nodia_ai:invalid_output');
    return { id: result.resource_id, propertyId: result.property_id };
  }
}

@Injectable()
export class BuildNodiaAiRentalConfigurationOperationsUseCase {
  readonly operations: readonly NodiaAiRentalConfigurationOperation[];
  constructor(
    store: NodiaAiRentalConfigurationService,
    createProperty: CreateRentalPropertyUseCase,
    updateProperty: UpdateRentalPropertyUseCase,
    createCollaborator: CreateRentalCollaboratorUseCase,
    updateCollaborator: UpdateRentalCollaboratorUseCase,
    createPolicy: CreateRentalCancellationPolicyUseCase,
    updatePolicy: UpdateRentalCancellationPolicyUseCase,
  ) {
    this.operations = Object.freeze([
      new RentalConfigurationOperation(
        'rental_properties',
        'create',
        store,
        (i, c) =>
          createProperty.execute(
            identity(c),
            i.command as unknown as CreateRentalPropertyDto,
            i.key,
          ),
      ),
      new RentalConfigurationOperation(
        'rental_properties',
        'update',
        store,
        (i, c) =>
          updateProperty.execute(
            identity(c),
            i.property!,
            i.command as unknown as UpdateRentalPropertyDto,
            i.key,
          ),
      ),
      new RentalConfigurationOperation(
        'rental_collaborators',
        'create',
        store,
        (i, c) =>
          createCollaborator.execute(
            identity(c),
            i.property!,
            i.command as unknown as CreateRentalCollaboratorDto,
            i.key,
          ),
      ),
      new RentalConfigurationOperation(
        'rental_collaborators',
        'update',
        store,
        (i, c) =>
          updateCollaborator.execute(
            identity(c),
            i.property!,
            i.id!,
            i.command as unknown as UpdateRentalCollaboratorDto,
            i.key,
          ),
      ),
      new RentalConfigurationOperation(
        'rental_cancellation_policies',
        'create',
        store,
        (i, c) =>
          createPolicy.execute(
            identity(c),
            i.property!,
            i.command as unknown as CreateRentalCancellationPolicyDto,
            i.key,
          ),
      ),
      new RentalConfigurationOperation(
        'rental_cancellation_policies',
        'update',
        store,
        (i, c) =>
          updatePolicy.execute(
            identity(c),
            i.property!,
            i.id!,
            i.command as unknown as UpdateRentalCancellationPolicyDto,
            i.key,
          ),
      ),
    ]);
  }
}
