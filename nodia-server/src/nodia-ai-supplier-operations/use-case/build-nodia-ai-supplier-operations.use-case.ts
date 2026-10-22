import { requireCompatibleProviderTransfer } from '../../provider/use-case/provider-transfer.rules.js';
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
import { isUUID, validateSync } from 'class-validator';
import {
  currentActor,
  lockAuthority,
} from '../../authorization/authority-transaction.js';
import { isFinanceBigint } from '../../finance-common/validation/finance-validation.js';
import type {
  NodiaAiJsonObject,
  NodiaAiJsonValue,
} from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiNativeOperation } from '../../nodia-ai-proposal/types/native-operation.types.js';
import type {
  ProposalFieldEdit,
  ProposalPreparation,
  ProposalPreparerContext,
  PreparedProposalStep,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import type { NodiaAiProposalBindingSource } from '../../nodia-ai-proposal/types/workflow.types.js';
import type { NodiaAiProposalReviewField } from '../../nodia-ai-proposal/types/proposal-review.types.js';
import { CreateProviderDto } from '../../provider/dto/create-provider.dto.js';
import { UpdateProviderDto } from '../../provider/dto/update-provider.dto.js';
import { CreateProviderUseCase } from '../../provider/use-case/create-provider.use-case.js';
import { UpdateProviderUseCase } from '../../provider/use-case/update-provider.use-case.js';
import { CreateProviderContactUseCase } from '../../provider-contact/use-case/create-provider-contact.use-case.js';
import { UpdateProviderContactUseCase } from '../../provider-contact/use-case/update-provider-contact.use-case.js';
import {
  normalizeContact,
  validateVersion,
  validateRequestKey,
} from '../../provider-contact/use-case/contact-validation.js';
import type { ContactValues } from '../../provider-contact/types/provider-contact.types.js';
import { NodiaAiSupplierOperationsService } from '../nodia-ai-supplier-operations.service.js';

type Resource = 'providers' | 'provider_contacts';
type Operation = 'create' | 'update' | 'set_active';
interface Input {
  business: string;
  id?: string;
  provider?: string;
  command: NodiaAiJsonObject;
  origins: NodiaAiJsonObject;
}
type Writer = (
  input: Input,
  context: ProposalPreparerContext,
) => Promise<{ id: string }>;
const route = '/tools/business';
const providerFields = {
  name: 'string',
  tax: 'number',
  fields: 'json_object',
  is_active: 'boolean',
  business_id: 'business_id',
};
const contactFields = {
  name: 'string',
  phone: 'contact_phones',
  email: 'nullable_string',
  schedule: 'contact_schedule',
  description: 'nullable_string',
  is_active: 'boolean',
};
const contactDefaults: NodiaAiJsonObject = {
  phone: [],
  email: null,
  schedule: {},
  description: null,
  is_active: true,
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
function providerUpdateDto(command: NodiaAiJsonObject): UpdateProviderDto {
  const dto = plainToInstance(UpdateProviderDto, command);
  // PartialType inherits Create initializers. Omission must preserve existing values.
  for (const key of Object.keys(dto))
    if (!Object.hasOwn(command, key))
      delete (dto as unknown as Record<string, unknown>)[key];
  return dto;
}
function bounded(value: unknown, maximum: number, depth = 0): void {
  if (depth > 8) return invalid();
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  )
    return;
  if (!value || typeof value !== 'object') return invalid();
  const items = Array.isArray(value) ? value : Object.values(value);
  if (items.length > maximum)
    throw new ConflictException('nodia_ai:result_too_large');
  for (const item of items) bounded(item, maximum, depth + 1);
}

class SupplierOperation implements NodiaAiNativeOperation {
  readonly toolName: string;
  readonly catalogVersion = 'nodia-ai-ai22-business/1';
  readonly moduleRoutes = [route];
  readonly actionKeys: readonly string[] = [];
  readonly bindableFields: Readonly<Record<string, string>>;
  readonly editableFields: Readonly<Record<string, string>>;
  readonly outputKeys: Readonly<Record<string, string>>;
  readonly reviewFields: readonly NodiaAiProposalReviewField[];
  readonly contractHash: string;
  private readonly contact: boolean;
  constructor(
    readonly resourceKey: Resource,
    readonly operation: Operation,
    private readonly store: NodiaAiSupplierOperationsService,
    private readonly writer: Writer,
  ) {
    this.contact = resourceKey === 'provider_contacts';
    this.bindableFields = this.contact && operation === 'create'
      ? { provider_id: 'provider_id' }
      : {};
    this.toolName = `nodia_${resourceKey}_prepare_${operation}`;
    this.editableFields =
      operation === 'set_active'
        ? { is_active: 'boolean' }
        : this.contact
          ? contactFields
          : operation === 'create'
            ? Object.fromEntries(
                Object.entries(providerFields).filter(
                  ([key]) => key !== 'business_id',
                ),
              )
            : providerFields;
    this.outputKeys = {
      id: this.contact ? 'provider_contact_id' : 'provider_id',
    };
    this.reviewFields = Object.keys(this.editableFields)
      .filter((k) =>
        ['name', 'email', 'description', 'is_active', 'tax'].includes(k),
      )
      .map((field_key) => ({
        field_key,
        label_key: `nodiaAi:proposal.business_fields.${field_key}`,
        kind:
          field_key === 'is_active'
            ? 'boolean'
            : field_key === 'tax'
              ? 'integer'
              : 'text',
        nullable: ['email', 'description'].includes(field_key),
        max_length:
          field_key === 'description'
            ? 2000
            : field_key === 'email'
              ? 254
              : field_key === 'name'
                ? 255
                : null,
        minimum: field_key === 'tax' ? '0' : null,
        maximum: field_key === 'tax' ? '100' : null,
        options: [],
      }));
    this.contractHash = createHash('sha256')
      .update(
        JSON.stringify({
          version: 'ai22-suppliers/1',
          resourceKey,
          operation,
          fields: this.editableFields,
          contactReplacement:
            'native-complete-values+omitted-contract-defaults/1',
          target: 'immutable_business_provider_id/1',
          preconditions:
            'locked_businesses_parent_target_all_public_values_exact_timestamp+version/1',
          requestKey: 'backend_uuid_v4_fixed_per_intent/1',
          transfer:
            'native_locked_no_products_or_invoices_in_another_business/1',
          ...(this.contact && operation === 'create'
            ? { futureProvider: 'verified_provider_create_output+known_values+first_binding/1' }
            : {}),
        }),
      )
      .digest('hex');
  }
  private decode(
    raw: NodiaAiJsonObject,
    context: ProposalPreparerContext,
  ): Input {
    const stored = Object.hasOwn(raw, 'schema_version');
    const allowed = stored
      ? [
          'schema_version',
          'business_id',
          'provider_id',
          'id',
          'command',
          'origins',
        ]
      : [
          'business_id',
          'provider_id',
          'id',
          ...(!this.contact && this.operation === 'update'
            ? ['destination_business_id']
            : []),
          ...Object.keys(this.editableFields).filter(
            (k) => k !== 'business_id',
          ),
        ];
    if (
      Object.keys(raw).some((k) => !allowed.includes(k)) ||
      (stored && raw.schema_version !== 1)
    )
      return invalid();
    const business = raw.business_id;
    if (
      business !== undefined &&
      (typeof business !== 'string' || !isUUID(business))
    )
      return invalid();
    const id = raw.id,
      provider = raw.provider_id;
    if (
      (id !== undefined && !isFinanceBigint(id)) ||
      (this.operation === 'create' && id !== undefined) ||
      (!this.contact && provider !== undefined) ||
      (provider !== undefined && !isFinanceBigint(provider))
    )
      return invalid();
    const command = stored
      ? { ...object(raw.command) }
      : Object.fromEntries(
          Object.entries(raw).filter(
            ([k]) => !['business_id', 'id', 'provider_id'].includes(k),
          ),
        );
    if (!stored && Object.hasOwn(command, 'destination_business_id')) {
      command.business_id = command.destination_business_id;
      delete command.destination_business_id;
    }
    const origins = stored
      ? { ...object(raw.origins) }
      : Object.fromEntries(Object.keys(command).map((k) => [k, 'user']));
    const extra = this.contact ? ['request_key', 'version'] : [];
    if (
      Object.keys(command).some(
        (k) =>
          !Object.hasOwn(this.editableFields, k) &&
          !(stored && extra.includes(k)),
      ) ||
      Object.keys(origins).length !== Object.keys(command).length ||
      Object.keys(command).some((k) => !Object.hasOwn(origins, k)) ||
      Object.values(origins).some(
        (v) =>
          !['user', 'contract_default', 'database', 'backend'].includes(
            String(v),
          ),
      )
    )
      return invalid();
    for (const [k, v] of Object.entries(command)) {
      if (v === undefined) return invalid();
      if (k === 'request_key') validateRequestKey(String(v));
      else if (k === 'version') validateVersion(v as number);
      else if (
        k === 'name' &&
        (typeof v !== 'string' ||
          !v.trim() ||
          v.trim().length > 255 ||
          (!this.contact && v.trim().length < 2))
      )
        return invalid();
      else if (k === 'is_active' && typeof v !== 'boolean') return invalid();
      else if (
        k === 'tax' &&
        (!Number.isInteger(v) || Number(v) < 0 || Number(v) > 100)
      )
        return invalid();
      else if (k === 'fields') object(v);
      else if (k === 'business_id' && (typeof v !== 'string' || !isUUID(v)))
        return invalid();
    }
    if (command.name !== undefined)
      command.name = this.contact
        ? String(command.name).trim()
        : String(command.name).trim().toLowerCase();
    bounded(command, context.maxCollectionItems ?? 128);
    if (Buffer.byteLength(JSON.stringify(command)) > 131072)
      throw new ConflictException('nodia_ai:result_too_large');
    if (this.contact) {
      const contactCommand = Object.fromEntries(
        Object.entries(command).filter(([k]) =>
          Object.hasOwn(contactFields, k),
        ),
      );
      const normalized = normalizeContact({
        ...contactDefaults,
        name: 'Validation',
        ...contactCommand,
      } as unknown as ContactValues);
      for (const k of Object.keys(contactCommand))
        command[k] = (normalized as unknown as NodiaAiJsonObject)[k];
    }
    return {
      business: typeof business === 'string' ? business : '',
      ...(id === undefined ? {} : { id: id as string }),
      ...(provider === undefined ? {} : { provider: provider as string }),
      command,
      origins,
    };
  }
  private template(input: Input): NodiaAiJsonObject {
    return {
      schema_version: 1,
      ...(input.business ? { business_id: input.business } : {}),
      ...(input.provider ? { provider_id: input.provider } : {}),
      ...(input.id ? { id: input.id } : {}),
      command: input.command,
      origins: input.origins,
    };
  }
  private scope(input: Input): NodiaAiJsonObject {
    return {
      business_id: input.business,
      ...(input.provider ? { provider_id: input.provider } : {}),
    };
  }
  private async authority(context: ProposalPreparerContext) {
    if (
      !context.manager.queryRunner?.isTransactionActive ||
      !context.moduleRoutes.includes(route)
    )
      throw new ForbiddenException('nodia_ai:capability_denied');
    await lockAuthority(context.manager, false, context.statementTimeoutMs);
    await currentActor(context.manager, {
      userId: context.actor.actorId,
      sessionId: context.actor.sessionId,
    });
  }
  async prepare(
    partial: NodiaAiJsonObject,
    context: ProposalPreparerContext,
    previousPartial?: NodiaAiJsonObject,
  ): Promise<ProposalPreparation> {
    if (
      ['schema_version', 'command', 'origins', 'request_key', 'version'].some(
        (key) => Object.hasOwn(partial, key),
      )
    )
      return invalid();
    return this.prepareInternal(partial, context, previousPartial);
  }
  async reprepareStored(
    template: NodiaAiJsonObject,
    context: ProposalPreparerContext,
  ): Promise<ProposalPreparation> {
    if (template.schema_version !== 1) return invalid();
    return this.prepareInternal(template, context);
  }
  private futureProvider(
    partial: NodiaAiJsonObject,
    bindings: readonly NodiaAiProposalBindingSource[],
    context: ProposalPreparerContext,
  ): NodiaAiJsonObject {
    if (!this.contact || this.operation !== 'create' || bindings.length !== 1)
      return invalid();
    const binding = bindings[0];
    const input = this.decode(partial, context);
    const source = binding.source;
    const template = source.commandTemplate;
    const command = object(template.command);
    if (binding.target_field_key !== 'provider_id' || binding.output_key !== 'id' ||
        binding.from_step_id !== source.id || source.toolName !== 'nodia_providers_prepare_create' ||
        source.outputBindings.length || input.provider || !input.business ||
        template.schema_version !== 1 || template.business_id !== input.business ||
        source.scope.business_id !== input.business ||
        typeof command.name !== 'string' || !Number.isInteger(command.tax) ||
        typeof command.is_active !== 'boolean') return invalid();
    return {
      from_step_id: source.id,
      source_contract_hash: source.contractHash,
      expected_provider: {
        business_id: input.business, name: command.name, tax: command.tax,
        fields: object(command.fields), is_active: command.is_active,
      },
    };
  }
  async prepareWithBindings(
    partial: NodiaAiJsonObject,
    bindings: readonly NodiaAiProposalBindingSource[],
    context: ProposalPreparerContext,
  ): Promise<ProposalPreparation> {
    const future = this.futureProvider(partial, bindings, context);
    return this.prepareInternal(partial, context, undefined, future);
  }
  async reprepareWithBindings(
    template: NodiaAiJsonObject,
    bindings: readonly NodiaAiProposalBindingSource[],
    context: ProposalPreparerContext,
  ): Promise<ProposalPreparation> {
    return this.prepareWithBindings(template, bindings, context);
  }
  async bindOutputs(
    step: StoredProposalStep,
    values: Readonly<Record<string, { readonly value: NodiaAiJsonValue; readonly source: StoredProposalStep }>>,
    context: ProposalPreparerContext,
  ): Promise<PreparedProposalStep> {
    if (Object.keys(values).length !== 1 || !values.provider_id || !isFinanceBigint(values.provider_id.value))
      return invalid();
    const future = this.futureProvider(step.commandTemplate, [{
      target_field_key: 'provider_id', output_key: 'id',
      from_step_id: values.provider_id.source.id, source: values.provider_id.source,
    }], context);
    if (!isDeepStrictEqual(future, step.preconditions.future_provider))
      throw new ConflictException('nodia_ai:preconditions_changed');
    await this.verifyPreconditions(step, context);
    const prepared = await this.prepareInternal({
      ...step.commandTemplate, provider_id: values.provider_id.value,
    }, context);
    if (prepared.status !== 'ready' ||
        !isDeepStrictEqual(prepared.commandTemplate.command, step.commandTemplate.command))
      throw new ConflictException('nodia_ai:preconditions_changed');
    const provider = object(prepared.preconditions.provider);
    const expected = object(future.expected_provider);
    if (Object.keys(expected).some(key => !isDeepStrictEqual(provider[key], expected[key])))
      throw new ConflictException('nodia_ai:preconditions_changed');
    return { ...prepared, publicStep: step.publicStep };
  }
  private async prepareInternal(
    partial: NodiaAiJsonObject,
    context: ProposalPreparerContext,
    previousPartial?: NodiaAiJsonObject,
    futureProvider?: NodiaAiJsonObject,
  ): Promise<ProposalPreparation> {
    let input: Input;
    if (previousPartial) {
      const previous = this.decode(previousPartial, context);
      const next = this.decode(
        Object.hasOwn(partial, 'schema_version')
          ? partial
          : {
              ...partial,
              business_id: partial.business_id ?? previous.business,
              ...(previous.provider && !Object.hasOwn(partial, 'provider_id')
                ? { provider_id: previous.provider }
                : {}),
              ...(previous.id && !Object.hasOwn(partial, 'id')
                ? { id: previous.id }
                : {}),
            },
        context,
      );
      if (
        (previous.business && next.business !== previous.business) ||
        (previous.provider && next.provider !== previous.provider) ||
        (previous.id && next.id !== previous.id)
      )
        return invalid();
      input = {
        ...next,
        command: { ...previous.command, ...next.command },
        origins: { ...previous.origins, ...next.origins },
      };
    } else input = this.decode(partial, context);
    await this.authority(context);
    const missing: string[] = [];
    if (!input.business) missing.push('business_id');
    if (this.contact && !input.provider && !futureProvider) missing.push('provider_id');
    if (this.operation !== 'create' && !input.id) missing.push('id');
    if (
      this.operation === 'create' ||
      (this.contact && this.operation === 'update')
    ) {
      if (!Object.hasOwn(input.command, 'name')) missing.push('name');
    }
    if (
      this.operation === 'set_active' &&
      !Object.hasOwn(input.command, 'is_active')
    )
      missing.push('is_active');
    if (
      this.operation === 'update' &&
      !this.contact &&
      !Object.keys(input.command).length
    )
      missing.push('changes');
    if (
      this.contact &&
      this.operation === 'create' &&
      !input.command.request_key
    ) {
      input.command.request_key = randomUUID();
      input.origins.request_key = 'backend';
    }
    if (missing.length)
      return {
        status: 'needs_clarification',
        partial: this.template(input),
        missingFields: missing,
        clarificationKeys: missing.map(
          (k) => `nodia_ai:supplier_${k}_required`,
        ),
      };
    const defaults = this.contact
      ? this.operation === 'set_active'
        ? {}
        : contactDefaults
      : this.operation === 'create'
        ? { tax: 19, fields: {}, is_active: true }
        : {};
    for (const [key, value] of Object.entries(defaults))
      if (!Object.hasOwn(input.command, key)) {
        input.command[key] = structuredClone(value);
        input.origins[key] = 'contract_default';
      }
    if (!this.contact) this.validateProvider(input);
    const preconditions = await this.snapshot(input, context, futureProvider);
    const target =
      preconditions.target === null ? null : object(preconditions.target);
    if (this.contact && this.operation !== 'create') {
      if (
        input.command.version !== undefined &&
        input.command.version !== target?.version
      )
        throw new ConflictException('nodia_ai:preconditions_changed');
      input.command.version = target!.version;
      input.origins.version = 'database';
    }
    const changes = Object.entries(input.command)
      .filter(([key]) => key !== 'request_key')
      .map(([field_key, value]) => ({
        field_key,
        before: target ? review(target[field_key] ?? null) : null,
        before_present: target !== null,
        after: review(value),
        after_present: true,
        origin: input.origins[field_key],
      }));
    const scope = this.scope(input);
    if (futureProvider) changes.push({
      field_key: 'provider_id', before: null, before_present: false,
      after: null, after_present: false, origin: 'future_step',
    });
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
              label: String(target.name),
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
    context: ProposalPreparerContext,
  ) {
    const input = this.decode(template, context);
    const seen = new Set<string>();
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
    const result = this.decode(this.template(input), context);
    await this.authority(context);
    return this.template(result);
  }
  async verifyAuthority(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ) {
    const input = this.decode(step.commandTemplate, context);
    if (
      step.toolName !== this.toolName ||
      step.contractHash !== this.contractHash ||
      !isDeepStrictEqual(step.scope, this.scope(input))
    )
      throw new ForbiddenException('nodia_ai:capability_denied');
    await this.authority(context);
  }
  async verifyPreconditions(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ) {
    await this.verifyAuthority(step, context);
    const input = this.decode(step.commandTemplate, context);
    try {
      if (
        !isDeepStrictEqual(
          await this.snapshot(input, context, step.preconditions.future_provider === undefined
            ? undefined : object(step.preconditions.future_provider)),
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
  async executeConfirmed(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ) {
    const input = this.decode(step.commandTemplate, context);
    if (
      !isDeepStrictEqual(this.template(input), step.commandTemplate) ||
      step.outputBindings.length ||
      !Array.isArray(step.publicStep.depends_on) ||
      step.publicStep.depends_on.length ||
      (this.operation !== 'create' && !input.id) ||
      (this.contact && !input.provider)
    )
      return invalid();
    if (
      (this.operation === 'create' ||
        (this.operation === 'update' && this.contact)) &&
      !input.command.name
    )
      return invalid();
    if (
      this.contact &&
      this.operation === 'create' &&
      !input.command.request_key
    )
      return invalid();
    if (this.contact && this.operation !== 'create' && !input.command.version)
      return invalid();
    if (
      this.operation === 'set_active' &&
      typeof input.command.is_active !== 'boolean'
    )
      return invalid();
    if (
      this.operation === 'update' &&
      !this.contact &&
      !Object.keys(input.command).length
    )
      return invalid();
    if (!this.contact) this.validateProvider(input);
    await this.verifyPreconditions(step, context);
    const result = await this.writer(input, context);
    if (!isFinanceBigint(result.id))
      throw new InternalServerErrorException('nodia_ai:invalid_output');
    return {
      id: result.id,
      businessId:
        !this.contact && typeof input.command.business_id === 'string'
          ? input.command.business_id
          : input.business,
    };
  }
  private validateProvider(input: Input): void {
    const dto =
      this.operation === 'create'
        ? plainToInstance(CreateProviderDto, {
            ...input.command,
            business_id: input.business,
          })
        : providerUpdateDto(input.command);
    if (
      validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length
    )
      return invalid();
  }

  private async snapshot(
    input: Input,
    context: ProposalPreparerContext,
    futureProvider?: NodiaAiJsonObject,
  ): Promise<NodiaAiJsonObject> {
    const ids = [
      ...new Set([
        input.business,
        ...(!this.contact && typeof input.command.business_id === 'string'
          ? [input.command.business_id]
          : []),
      ]),
    ].sort();
    const businesses: NodiaAiJsonObject[] = [];
    for (const id of ids) {
      const row = await this.store.business(context.manager, id);
      if (!row) throw new NotFoundException('Business not found');
      businesses.push(row);
    }
    if (futureProvider && (!this.contact || this.operation !== 'create' || input.provider || input.id))
      return invalid();
    const provider = this.contact && !futureProvider
      ? await this.store.provider(
          context.manager,
          input.business,
          input.provider!,
        )
      : null;
    if (this.contact && !futureProvider && !provider)
      throw new NotFoundException('Provider not found for this business');
    const target =
      this.operation === 'create'
        ? null
        : this.contact
          ? await this.store.contact(
              context.manager,
              input.provider!,
              input.id!,
            )
          : await this.store.provider(
              context.manager,
              input.business,
              input.id!,
            );
    if (this.operation !== 'create' && !target)
      throw new NotFoundException('Target not found for this scope');
    const transferReferences =
      !this.contact &&
      this.operation === 'update' &&
      typeof input.command.business_id === 'string' &&
      input.command.business_id !== input.business
        ? await requireCompatibleProviderTransfer(
            context.manager,
            input.id!,
            input.command.business_id,
          )
        : null;
    const snapshot = {
      schema_version: 1,
      transfer_references: transferReferences,
      destination_business_id:
        !this.contact && typeof input.command.business_id === 'string'
          ? input.command.business_id
          : input.business,
      businesses,
      provider,
      target,
      ...(futureProvider ? { future_provider: futureProvider } : {}),
    };
    bounded(snapshot, context.maxCollectionItems ?? 128);
    return snapshot;
  }
}

@Injectable()
export class BuildNodiaAiSupplierOperationsUseCase {
  readonly operations: readonly NodiaAiNativeOperation[];
  constructor(
    store: NodiaAiSupplierOperationsService,
    create: CreateProviderUseCase,
    update: UpdateProviderUseCase,
    createContact: CreateProviderContactUseCase,
    updateContact: UpdateProviderContactUseCase,
  ) {
    this.operations = Object.freeze([
      new SupplierOperation('providers', 'create', store, (input, ctx) =>
        create.execute(
          plainToInstance(CreateProviderDto, {
            ...input.command,
            business_id: input.business,
          }),
          ctx.manager,
        ),
      ),
      new SupplierOperation('providers', 'update', store, (input, ctx) =>
        update.execute(
          input.id!,
          providerUpdateDto(input.command),
          ctx.manager,
        ),
      ),
      new SupplierOperation(
        'provider_contacts',
        'create',
        store,
        (input, ctx) =>
          createContact.execute(
            input.provider!,
            input.command as unknown as Parameters<
              CreateProviderContactUseCase['execute']
            >[1],
            ctx.manager,
          ),
      ),
      new SupplierOperation(
        'provider_contacts',
        'update',
        store,
        (input, ctx) =>
          updateContact.execute(
            input.provider!,
            input.id!,
            input.command as unknown as Parameters<
              UpdateProviderContactUseCase['execute']
            >[2],
            ctx.manager,
          ),
      ),
      new SupplierOperation(
        'provider_contacts',
        'set_active',
        store,
        (input, ctx) =>
          updateContact.execute(
            input.provider!,
            input.id!,
            input.command as unknown as Parameters<
              UpdateProviderContactUseCase['execute']
            >[2],
            ctx.manager,
          ),
      ),
    ]);
  }
}
