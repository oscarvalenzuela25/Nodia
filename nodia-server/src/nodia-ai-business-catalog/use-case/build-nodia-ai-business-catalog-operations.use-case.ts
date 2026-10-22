import { createHash } from 'node:crypto';
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
import { CreateBusinessDto } from '../../business/dto/create-business.dto.js';
import { UpdateBusinessDto } from '../../business/dto/update-business.dto.js';
import { AssignCollaboratorsDto } from '../../business/dto/assign-collaborators.dto.js';
import { CreateBusinessUseCase } from '../../business/use-case/create-business.use-case.js';
import { UpdateBusinessUseCase } from '../../business/use-case/update-business.use-case.js';
import { AssignBusinessCollaboratorsUseCase } from '../../business/use-case/assign-business-collaborators.use-case.js';
import { CreateProductDto } from '../../product/dto/create-product.dto.js';
import { UpdateProductDto } from '../../product/dto/update-product.dto.js';
import { CreateProductLogDto } from '../../product/dto/create-product-log.dto.js';
import { UpdateProductLogDto } from '../../product/dto/update-product-log.dto.js';
import { CreateProductUseCase } from '../../product/use-case/create-product.use-case.js';
import { UpdateProductUseCase } from '../../product/use-case/update-product.use-case.js';
import { CreateProductLogUseCase } from '../../product/use-case/create-product-log.use-case.js';
import { UpdateProductLogUseCase } from '../../product/use-case/update-product-log.use-case.js';
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
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import type { NodiaAiProposalReviewField } from '../../nodia-ai-proposal/types/proposal-review.types.js';
import {
  NodiaAiBusinessCatalogService,
  type BusinessCatalogResource,
} from '../nodia-ai-business-catalog.service.js';
type Operation = 'create' | 'update' | 'set_collaborators';
type Input = {
  businessId?: string;
  id?: string;
  command: NodiaAiJsonObject;
  origins: NodiaAiJsonObject;
};
type Writer = (
  input: Input,
  context: ProposalPreparerContext,
) => Promise<{ id: string } | void>;
const route = '/tools/business';
const numbers = [
  'cost_price',
  'cost_price_tax',
  'profit_percentage',
  'sale_price',
  'stock',
];
const invalid = (): never => {
  throw new BadRequestException('nodia_ai:invalid_input');
};
const object = (v: NodiaAiJsonValue | undefined): NodiaAiJsonObject =>
  !v || typeof v !== 'object' || Array.isArray(v) ? invalid() : v;
const uuid = (v: unknown): v is string => typeof v === 'string' && isUUID(v);
const review = (v: NodiaAiJsonValue): NodiaAiJsonValue =>
  Array.isArray(v)
    ? { kind: 'array', items: v.map(review) }
    : v !== null && typeof v === 'object'
      ? {
          kind: 'object',
          fields: Object.entries(v).map(([field_key, value]) => ({
            field_key,
            value: review(value),
          })),
        }
      : v;
const snapshotFields = ['code', 'name', ...numbers];
/** PartialType may initialize defaults; only the frozen keys may reach a writer. */
function commandDto<T extends object>(
  ctor: new () => T,
  command: NodiaAiJsonObject,
): T {
  const dto = plainToInstance(ctor, command);
  for (const key of Object.keys(dto))
    if (!Object.hasOwn(command, key))
      delete (dto as Record<string, unknown>)[key];
  return dto;
}
class BusinessCatalogOperation implements NodiaAiNativeOperation {
  readonly toolName: string;
  readonly contractHash: string;
  readonly catalogVersion = 'nodia-ai-ai22-business/1';
  readonly moduleRoutes = [route];
  readonly actionKeys: readonly string[] = [];
  readonly editableFields: Readonly<Record<string, string>>;
  readonly bindableFields = {};
  readonly outputKeys: Readonly<Record<string, string>>;
  readonly reviewFields: readonly NodiaAiProposalReviewField[];
  private readonly required: readonly string[];
  constructor(
    readonly resourceKey: BusinessCatalogResource,
    readonly operation: Operation,
    private readonly store: NodiaAiBusinessCatalogService,
    private readonly writer: Writer,
  ) {
    this.toolName = `nodia_${resourceKey}_prepare_${operation}`;
    this.editableFields =
      operation === 'set_collaborators'
        ? { users: 'business_collaborators' }
        : resourceKey === 'businesses'
          ? { name: 'string', is_active: 'boolean', translates: 'translations' }
          : {
              code: 'string',
              name: 'string',
              cost_price: 'integer',
              cost_price_tax: 'integer',
              profit_percentage: 'integer',
              sale_price: 'integer',
              stock: 'integer',
              ...(resourceKey === 'products'
                ? {
                    business_id: 'business_id',
                    provider_id: 'provider_id',
                    is_active: 'boolean',
                  }
                : { product_id: 'product_id' }),
            };
    this.required =
      operation === 'set_collaborators'
        ? ['users']
        : operation !== 'create'
          ? []
          : resourceKey === 'businesses'
            ? ['name']
            : [
                ...snapshotFields.filter((key) => key !== 'stock'),
                ...(resourceKey === 'product_logs' ? ['product_id'] : []),
              ];
    this.outputKeys = {
      id:
        resourceKey === 'businesses'
          ? 'business_id'
          : resourceKey === 'products'
            ? 'product_id'
            : 'product_log_id',
    };
    this.contractHash = createHash('sha256')
      .update(
        JSON.stringify({
          version: 'nodia-ai-business-catalog/1',
          resourceKey,
          operation,
          fields: this.editableFields,
          required: this.required,
          target: 'immutable_top_level_id_and_origin_business/1',
          preconditions:
            'exact_material_values_and_references_and_translations_or_collaborators/1',
          derived: 'product_snapshot_after_every_product_write/1',
          native: 'shared_entity_manager/1',
        }),
      )
      .digest('hex');
    this.reviewFields = Object.keys(this.editableFields)
      .filter((key) => ['name', 'code', 'is_active', ...numbers].includes(key))
      .map((field_key) => ({
        field_key,
        label_key: `nodiaAi:proposal.business_fields.${field_key}`,
        kind:
          field_key === 'is_active'
            ? 'boolean'
            : numbers.includes(field_key)
              ? 'integer'
              : 'text',
        nullable: false,
        max_length:
          numbers.includes(field_key) || field_key === 'is_active' ? null : 255,
        minimum: numbers.includes(field_key)
          ? field_key === 'stock'
            ? '0'
            : '-2147483648'
          : null,
        maximum: numbers.includes(field_key) ? '2147483647' : null,
        options: [],
      }));
  }
  private validate(command: NodiaAiJsonObject, partial: boolean): void {
    if (
      Object.keys(command).some(
        (key) => !Object.hasOwn(this.editableFields, key),
      ) ||
      Object.values(command).some((v) => v === undefined)
    )
      invalid();
    for (const [key, value] of Object.entries(command)) {
      if (value === null && key !== 'provider_id') invalid();
      if (
        numbers.includes(key) &&
        (typeof value !== 'number' ||
          !Number.isInteger(value) ||
          value < (key === 'stock' ? 0 : -2147483648) ||
          value > 2147483647)
      )
        invalid();
      if (
        ['name', 'code'].includes(key) &&
        (typeof value !== 'string' || !value.trim() || Array.from(value).length > 255)
      )
        invalid();
      if (key === 'provider_id' && value !== null && !isFinanceBigint(value))
        invalid();
      if (key === 'product_id' && !isFinanceBigint(value)) invalid();
      if (key === 'business_id' && !uuid(value)) invalid();
    }
    if (command.users !== undefined) {
      if (!Array.isArray(command.users) || command.users.length === 0)
        invalid();
      const ids = new Set<string>();
      for (const item of command.users as NodiaAiJsonValue[]) {
        const user = object(item);
        if (
          !isFinanceBigint(user.user_id) ||
          ids.has(user.user_id) ||
          Object.keys(user).some(
            (key) => !['user_id', 'position', 'action_ids'].includes(key),
          ) ||
          !Array.isArray(user.action_ids) ||
          user.action_ids.some((id) => !isFinanceBigint(id)) ||
          new Set(user.action_ids).size !== user.action_ids.length ||
          (user.position !== undefined &&
            user.position !== null &&
            (typeof user.position !== 'string' || Array.from(user.position).length > 255))
        )
          invalid();
        ids.add(user.user_id as string);
      }
    }
    if (command.translates !== undefined) {
      if (!Array.isArray(command.translates)) invalid();
      const keys = new Set<string>();
      for (const item of command.translates as NodiaAiJsonValue[]) {
        const translation = object(item);
        if (
          Object.keys(translation).some(
            (key) => !['key', 'es', 'en'].includes(key),
          ) ||
          typeof translation.key !== 'string' ||
          !translation.key ||
          Array.from(translation.key).length > 255 ||
          keys.has(translation.key)
        )
          invalid();
        keys.add(translation.key as string);
      }
    }
    const ctor: new () => object =
      this.operation === 'set_collaborators'
        ? AssignCollaboratorsDto
        : this.resourceKey === 'businesses'
          ? this.operation === 'create'
            ? CreateBusinessDto
            : UpdateBusinessDto
          : this.resourceKey === 'products'
            ? this.operation === 'create'
              ? CreateProductDto
              : UpdateProductDto
            : this.operation === 'create'
              ? CreateProductLogDto
              : UpdateProductLogDto;
    const dto = plainToInstance(ctor, command);
    if (
      validateSync(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
        skipUndefinedProperties: partial,
      }).length
    )
      invalid();
    for (const key of Object.keys(command))
      command[key] = JSON.parse(
        JSON.stringify((dto as Record<string, unknown>)[key]),
      ) as NodiaAiJsonValue;
  }
  private decode(value: NodiaAiJsonObject, stored = false): Input {
    if (
      stored !== Object.hasOwn(value, 'schema_version') ||
      (!stored && Object.hasOwn(value, 'origins'))
    )
      invalid();
    if (Object.values(value).some((item) => item === undefined)) invalid();
    let input: Input;
    if (Object.hasOwn(value, 'schema_version')) {
      if (
        value.schema_version !== 1 ||
        Object.keys(value).some(
          (key) =>
            ![
              'schema_version',
              'business_id',
              'id',
              'command',
              'origins',
            ].includes(key),
        )
      )
        invalid();
      input = {
        ...(value.business_id === undefined
          ? {}
          : { businessId: value.business_id as string }),
        ...(value.id === undefined ? {} : { id: value.id as string }),
        command: { ...object(value.command) },
        origins: { ...object(value.origins) },
      };
      if (
        Object.keys(input.command).length !==
          Object.keys(input.origins).length ||
        Object.keys(input.command).some(
          (key) => !Object.hasOwn(input.origins, key),
        )
      )
        invalid();
      for (const [key, origin] of Object.entries(input.origins))
        if (
          origin !== 'user' &&
          !(
            origin === 'contract_default' &&
            this.operation === 'create' &&
            ((key === 'stock' && input.command[key] === 0) ||
              (key === 'is_active' && input.command[key] === true) ||
              (key === 'provider_id' && input.command[key] === null))
          )
        )
          invalid();
    } else {
      const { business_id, id, ...fields } = value;
      const command = Object.hasOwn(fields, 'command')
        ? Object.keys(fields).length === 1
          ? { ...object(fields.command) }
          : invalid()
        : fields;
      input = {
        ...(business_id === undefined
          ? {}
          : { businessId: business_id as string }),
        ...(id === undefined ? {} : { id: id as string }),
        command,
        origins: Object.fromEntries(
          Object.keys(command).map((key) => [key, 'user']),
        ),
      };
      if (
        this.resourceKey === 'products' &&
        this.operation === 'create' &&
        business_id !== undefined
      ) {
        input.command.business_id = business_id;
        input.origins.business_id = 'user';
      }
    }
    if (
      (input.businessId !== undefined && !uuid(input.businessId)) ||
      (input.id !== undefined &&
        !(this.resourceKey === 'products'
          ? isFinanceBigint(input.id)
          : uuid(input.id))) ||
      (this.operation === 'create' && input.id !== undefined) ||
      (this.resourceKey === 'businesses' &&
        this.operation === 'create' &&
        input.businessId !== undefined)
    )
      invalid();
    if (
      this.resourceKey === 'businesses' &&
      input.id !== undefined &&
      input.businessId !== undefined &&
      input.id !== input.businessId
    )
      invalid();
    this.validate(input.command, true);
    return input;
  }
  private template(input: Input): NodiaAiJsonObject {
    return {
      schema_version: 1,
      ...(input.businessId === undefined
        ? {}
        : { business_id: input.businessId }),
      ...(input.id === undefined ? {} : { id: input.id }),
      command: input.command,
      origins: input.origins,
    };
  }
  private async authority(
    input: Input,
    context: ProposalPreparerContext,
    mutation = false,
  ): Promise<void> {
    if (!context.manager.queryRunner?.isTransactionActive)
      throw new ForbiddenException('authorization:transaction_required');
    if (!context.moduleRoutes.includes(route))
      throw new ForbiddenException('nodia_ai:capability_denied');
    await lockAuthority(context.manager, false, context.statementTimeoutMs);
    const actor = await currentActor(context.manager, {
      userId: context.actor.actorId,
      sessionId: context.actor.sessionId,
    });
    if (
      this.resourceKey === 'businesses' &&
      this.operation !== 'create' &&
      input.businessId
    ) {
      const business = await this.store.business(
        context.manager,
        input.businessId,
        mutation ? true : null,
      );
      if (!business) throw new NotFoundException('Business not found');
      if (business.owner_id !== actor.actorId && !actor.isSuperAdmin)
        throw new ForbiddenException(
          'Only the business owner can manage this business',
        );
    }
  }
  async prepare(
    partial: NodiaAiJsonObject,
    context: ProposalPreparerContext,
    previousPartial?: NodiaAiJsonObject,
  ): Promise<ProposalPreparation> {
    let input = this.decode(partial);
    if (previousPartial !== undefined) {
      const previous = this.decode(previousPartial, true);
      if (
        (input.businessId !== undefined &&
          previous.businessId !== undefined &&
          input.businessId !== previous.businessId) ||
        (input.id !== undefined &&
          previous.id !== undefined &&
          input.id !== previous.id)
      )
        invalid();
      input = {
        ...input,
        businessId: input.businessId ?? previous.businessId,
        id: input.id ?? previous.id,
        command: { ...previous.command, ...input.command },
        origins: { ...previous.origins, ...input.origins },
      };
    }
    return this.prepareDecoded(input, context);
  }
  async reprepareStored(
    template: NodiaAiJsonObject,
    context: ProposalPreparerContext,
  ): Promise<ProposalPreparation> {
    return this.prepareDecoded(this.decode(template, true), context);
  }
  private async prepareDecoded(
    input: Input,
    context: ProposalPreparerContext,
  ): Promise<ProposalPreparation> {
    if (this.resourceKey === 'businesses' && this.operation !== 'create') {
      input.businessId ??= input.id;
      input.id ??= input.businessId;
    }
    await this.authority(input, context, true);
    const limit = context.maxCollectionItems ?? 100;
    if (
      (Array.isArray(input.command.translates) &&
        input.command.translates.length > limit) ||
      (Array.isArray(input.command.users) && input.command.users.length > limit)
    )
      throw new ConflictException('nodia_ai:result_too_large');
    const missingFields = this.required.filter(
      (key) => !Object.hasOwn(input.command, key),
    );
    if (this.operation !== 'create' && !input.id) missingFields.push('id');
    if (
      !(this.resourceKey === 'businesses' && this.operation === 'create') &&
      !input.businessId
    )
      missingFields.push('business_id');
    if (this.operation === 'update' && !Object.keys(input.command).length)
      missingFields.push('changes');
    if (missingFields.length)
      return {
        status: 'needs_clarification',
        partial: this.template(input),
        missingFields,
        clarificationKeys: missingFields.map(
          (key) => `nodia_ai:business_${key}_required`,
        ),
      };
    if (this.operation === 'create') {
      const defaults: NodiaAiJsonObject =
        this.resourceKey === 'businesses'
          ? { is_active: true }
          : this.resourceKey === 'products'
            ? { stock: 0, is_active: true, provider_id: null }
            : { stock: 0 };
      for (const [key, value] of Object.entries(defaults))
        if (!Object.hasOwn(input.command, key)) {
          input.command[key] = value;
          input.origins[key] = 'contract_default';
        }
    }
    this.validate(input.command, false);
    const preconditions = await this.snapshot(input, context);
    const target =
      preconditions.target === null ? null : object(preconditions.target);
    const changes: NodiaAiJsonObject[] = Object.entries(input.command).map(
      ([field_key, value]) => ({
        field_key,
        before:
          target === null
            ? null
            : Object.hasOwn(target, field_key)
              ? review(target[field_key])
              : field_key === 'translates'
                ? review(preconditions.translations ?? [])
                : field_key === 'users'
                  ? review(preconditions.collaborators ?? [])
                  : null,
        before_present: target !== null,
        after: review(value),
        after_present: true,
        origin: input.origins[field_key],
      }),
    );
    if (this.operation === 'set_collaborators') {
      const old = preconditions.collaborators as NodiaAiJsonObject[];
      const after = (input.command.users as NodiaAiJsonObject[]).map((user) => {
        const previous = old.find((item) => item.user_id === user.user_id);
        const actions = user.action_ids as NodiaAiJsonValue[];
        return {
          user_id: user.user_id,
          position: actions.length
            ? user.position === undefined
              ? (previous?.position ?? null)
              : user.position
            : (previous?.position ?? null),
          action_ids: actions,
          is_active: actions.length > 0,
        };
      });
      changes.push({
        field_key: 'collaborator_effects',
        before: review(
          old.filter((item) =>
            after.some((user) => user.user_id === item.user_id),
          ),
        ),
        before_present: true,
        after: review(after),
        after_present: true,
        origin: 'database',
      });
    }
    if (this.resourceKey === 'products') {
      const fields = Object.fromEntries(
        snapshotFields.map((key) => [
          key,
          Object.hasOwn(input.command, key) ? input.command[key] : target![key],
        ]),
      );
      changes.push({
        field_key: 'product_snapshot',
        before: null,
        before_present: false,
        after: review(fields),
        after_present: true,
        origin: 'database',
      });
    }
    if (
      this.resourceKey === 'businesses' &&
      this.operation !== 'set_collaborators'
    ) {
      const translates = input.command.translates as
        NodiaAiJsonObject[] | undefined;
      const hasDescription =
        translates === undefined
          ? (target?.has_description ?? false)
          : translates.some(
              (item) =>
                ['description', 'comment'].includes(String(item.key)) &&
                Boolean(
                  String(item.es ?? '').trim() || String(item.en ?? '').trim(),
                ),
            );
      if (translates !== undefined) {
        const before = (preconditions.translations ??
          []) as NodiaAiJsonObject[];
        const values = before.map((row) => ({
          key: row.source_key,
          locale: row.locale,
          value: row.value,
          is_active: row.is_active,
        }));
        for (const item of translates)
          for (const locale of ['es', 'en']) {
            if (item[locale] === undefined || item[locale] === null) continue;
            const existing = values.find(
              (row) => row.key === item.key && row.locale === locale,
            );
            if (existing) {
              existing.value = item[locale];
              existing.is_active = true;
            } else
              values.push({
                key: item.key,
                locale,
                value: item[locale],
                is_active: true,
              });
          }
        values.sort((a, b) =>
          `${a.key}:${a.locale}`.localeCompare(`${b.key}:${b.locale}`),
        );
        changes.push({
          field_key: 'translation_effects',
          before:
            target === null
              ? null
              : review(
                  before.map((row) => ({
                    key: row.source_key,
                    locale: row.locale,
                    value: row.value,
                    is_active: row.is_active,
                  })),
                ),
          before_present: target !== null,
          after: review(values),
          after_present: true,
          origin: 'database',
        });
      }
      changes.push({
        field_key: 'has_description',
        before: target?.has_description ?? null,
        before_present: target !== null,
        after: hasDescription,
        after_present: true,
        origin: 'database',
      });
    }
    if (
      input.businessId &&
      preconditions.destination_business_id !== input.businessId
    )
      changes.push({
        field_key: 'destination_business_id',
        before: input.businessId,
        before_present: true,
        after: preconditions.destination_business_id,
        after_present: true,
        origin: 'database',
      });
    const scope: NodiaAiJsonObject = input.businessId
      ? { business_id: input.businessId }
      : {};
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
              label: String(target.name ?? target.code ?? input.id),
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
  ): Promise<NodiaAiJsonObject> {
    const input = this.decode(template, true);
    const seen = new Set<string>();
    for (const edit of edits) {
      if (
        !Object.hasOwn(this.editableFields, edit.field_key) ||
        seen.has(edit.field_key)
      )
        invalid();
      seen.add(edit.field_key);
      input.command[edit.field_key] = edit.value;
      input.origins[edit.field_key] = 'user';
    }
    this.validate(input.command, true);
    await this.authority(input, context, true);
    return this.template(input);
  }
  async verifyAuthority(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<void> {
    const input = this.decode(step.commandTemplate, true);
    if (
      step.toolName !== this.toolName ||
      step.contractHash !== this.contractHash ||
      !isDeepStrictEqual(
        step.scope,
        input.businessId ? { business_id: input.businessId } : {},
      )
    )
      throw new ForbiddenException('nodia_ai:capability_denied');
    await this.authority(input, context);
  }
  async verifyPreconditions(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<void> {
    await this.authority(
      this.decode(step.commandTemplate, true),
      context,
      true,
    );
    await this.verifyAuthority(step, context);
    let snapshot: NodiaAiJsonObject;
    try {
      snapshot = await this.snapshot(
        this.decode(step.commandTemplate, true),
        context,
      );
    } catch (error) {
      if (
        error instanceof HttpException &&
        [400, 404, 409].includes(error.getStatus())
      )
        throw new ConflictException('nodia_ai:preconditions_changed');
      throw error;
    }
    if (!isDeepStrictEqual(step.preconditions, snapshot))
      throw new ConflictException('nodia_ai:preconditions_changed');
  }
  async executeConfirmed(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<{ id: string; businessId: string }> {
    const input = this.decode(step.commandTemplate, true);
    if (
      !isDeepStrictEqual(step.commandTemplate, this.template(input)) ||
      step.outputBindings.length ||
      !Array.isArray(step.publicStep.depends_on) ||
      step.publicStep.depends_on.length ||
      this.required.some((key) => !Object.hasOwn(input.command, key)) ||
      (this.operation !== 'create' && !input.id) ||
      (this.operation === 'update' && !Object.keys(input.command).length)
    )
      invalid();
    this.validate(input.command, false);
    await this.verifyPreconditions(step, context);
    const result = await this.writer(input, context);
    const id = this.operation === 'set_collaborators' ? input.id : result?.id;
    if (!(this.resourceKey === 'products' ? isFinanceBigint(id) : uuid(id)))
      throw new InternalServerErrorException('nodia_ai:invalid_output');
    const businessId =
      this.resourceKey === 'businesses' && this.operation === 'create'
        ? id
        : step.preconditions.destination_business_id;
    if (!uuid(businessId))
      throw new InternalServerErrorException('nodia_ai:invalid_output');
    return { id: id!, businessId };
  }
  private async snapshot(
    input: Input,
    context: ProposalPreparerContext,
  ): Promise<NodiaAiJsonObject> {
    const manager = context.manager;
    const limit = context.maxCollectionItems ?? 100;
    if (
      this.resourceKey === 'products' &&
      this.operation === 'create' &&
      input.command.business_id !== input.businessId
    )
      invalid();
    const target =
      this.operation === 'create'
        ? null
        : await this.store.target(manager, this.resourceKey, input.id!);
    if (this.operation !== 'create' && !target)
      throw new NotFoundException('Resource not found');
    const result: NodiaAiJsonObject = { schema_version: 1, target };
    if (this.resourceKey === 'businesses') {
      if (this.operation === 'create') return result;
      if (target!.id !== input.businessId) invalid();
      result.destination_business_id = input.businessId!;
      if (this.operation !== 'set_collaborators') {
        const translations = await this.store.translations(
          manager,
          input.id!,
          limit + 1,
        );
        if (translations.length > limit)
          throw new ConflictException('nodia_ai:result_too_large');
        result.translations = translations;
      } else {
        const users = input.command.users as NodiaAiJsonObject[];
        if (
          users.length > limit ||
          users.some(
            (user) => (user.action_ids as NodiaAiJsonValue[]).length > limit,
          )
        )
          throw new ConflictException('nodia_ai:result_too_large');
        result.collaborators = await this.store.collaborators(
          manager,
          input.businessId!,
          limit + 1,
        );
        if ((result.collaborators as NodiaAiJsonValue[]).length > limit)
          throw new ConflictException('nodia_ai:result_too_large');
        result.users = await this.store.users(
          manager,
          users.map((user) => String(user.user_id)),
        );
        if (
          (result.users as NodiaAiJsonObject[]).length !== users.length ||
          (result.users as NodiaAiJsonObject[]).some(
            (user) => user.is_active !== true,
          )
        )
          throw new BadRequestException('Invalid or inactive user');
        const ids = [
          ...new Set(users.flatMap((user) => user.action_ids as string[])),
        ];
        if (ids.length > limit) throw new ConflictException('nodia_ai:result_too_large');
        result.actions = await this.store.actions(manager, ids);
        if (
          (result.actions as NodiaAiJsonObject[]).length !== ids.length ||
          (result.actions as NodiaAiJsonObject[]).some(
            (action) => action.is_active !== true,
          )
        )
          throw new BadRequestException('Invalid or inactive business action');
      }
      return result;
    }
    let destinationBusiness: string;
    if (this.resourceKey === 'product_logs') {
      const originProduct = target
        ? await this.store.product(manager, String(target.product_id))
        : null;
      const productId = String(input.command.product_id ?? target?.product_id);
      const product = await this.store.product(manager, productId);
      if (
        !product ||
        (target &&
          (!originProduct || originProduct.business_id !== input.businessId))
      )
        throw new NotFoundException('Product not found in specified business');
      if (!target && product.business_id !== input.businessId) invalid();
      result.origin_product = originProduct;
      result.product = product;
      destinationBusiness = String(product.business_id);
    } else {
      if (target && target.business_id !== input.businessId)
        throw new NotFoundException('Product not found in specified business');
      destinationBusiness = String(
        input.command.business_id ?? input.businessId,
      );
      const providerId =
        input.command.provider_id === undefined
          ? (target?.provider_id ?? null)
          : input.command.provider_id;
      const provider =
        providerId === null
          ? null
          : await this.store.provider(manager, String(providerId));
      if (
        providerId !== null &&
        (!provider || provider.business_id !== destinationBusiness)
      )
        throw new BadRequestException(
          'Provider does not belong to this business',
        );
      result.provider = provider;
      if (
        await this.store.duplicateProduct(
          manager,
          destinationBusiness,
          String(input.command.code ?? target?.code),
          input.id ?? null,
        )
      )
        throw new ConflictException(
          'Product code already exists in this business',
        );
    }
    const businessIds = [
      ...new Set([input.businessId!, destinationBusiness]),
    ].sort();
    result.businesses = [];
    for (const id of businessIds) {
      const business = await this.store.business(manager, id);
      if (!business) throw new NotFoundException('Business not found');
      (result.businesses as NodiaAiJsonValue[]).push(business);
    }
    result.destination_business_id = destinationBusiness;
    return result;
  }
}
@Injectable()
export class BuildNodiaAiBusinessCatalogOperationsUseCase {
  readonly operations: readonly NodiaAiNativeOperation[];
  constructor(
    store: NodiaAiBusinessCatalogService,
    createBusiness: CreateBusinessUseCase,
    updateBusiness: UpdateBusinessUseCase,
    assignCollaborators: AssignBusinessCollaboratorsUseCase,
    createProduct: CreateProductUseCase,
    updateProduct: UpdateProductUseCase,
    createLog: CreateProductLogUseCase,
    updateLog: UpdateProductLogUseCase,
  ) {
    this.operations = Object.freeze([
      new BusinessCatalogOperation(
        'businesses',
        'create',
        store,
        (input, context) =>
          createBusiness.execute(
            context.actor.actorId,
            commandDto(CreateBusinessDto, input.command),
            context.manager,
          ),
      ),
      new BusinessCatalogOperation(
        'businesses',
        'update',
        store,
        (input, context) =>
          updateBusiness.execute(
            input.id!,
            context.actor.actorId,
            commandDto(UpdateBusinessDto, input.command),
            context.manager,
          ),
      ),
      new BusinessCatalogOperation(
        'businesses',
        'set_collaborators',
        store,
        async (input, context) => {
          await assignCollaborators.execute(
            input.id!,
            context.actor.actorId,
            commandDto(AssignCollaboratorsDto, input.command),
            context.manager,
          );
        },
      ),
      new BusinessCatalogOperation(
        'products',
        'create',
        store,
        (input, context) =>
          createProduct.execute(
            commandDto(CreateProductDto, input.command),
            context.manager,
          ),
      ),
      new BusinessCatalogOperation(
        'products',
        'update',
        store,
        (input, context) =>
          updateProduct.execute(
            input.id!,
            commandDto(UpdateProductDto, input.command),
            context.manager,
          ),
      ),
      new BusinessCatalogOperation(
        'product_logs',
        'create',
        store,
        (input, context) =>
          createLog.execute(
            commandDto(CreateProductLogDto, input.command),
            context.manager,
          ),
      ),
      new BusinessCatalogOperation(
        'product_logs',
        'update',
        store,
        (input, context) =>
          updateLog.execute(
            input.id!,
            commandDto(UpdateProductLogDto, input.command),
            context.manager,
          ),
      ),
    ]);
  }
}
