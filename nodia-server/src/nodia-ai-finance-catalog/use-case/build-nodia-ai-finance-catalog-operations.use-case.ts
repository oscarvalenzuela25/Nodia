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
import { validateSync } from 'class-validator';
import type { FinanceActor } from '../../authorization/authority-transaction.js';
import { isFinanceBigint } from '../../finance-common/validation/finance-validation.js';
import { FinanceCategoryService } from '../../finance-category/finance-category.service.js';
import { CreateFinanceCategoryDto } from '../../finance-category/dto/create-finance-category.dto.js';
import { UpdateFinanceCategoryDto } from '../../finance-category/dto/update-finance-category.dto.js';
import { CreateFinanceCategoryUseCase } from '../../finance-category/use-case/create-finance-category.use-case.js';
import { UpdateFinanceCategoryUseCase } from '../../finance-category/use-case/update-finance-category.use-case.js';
import { DeleteFinanceCategoryUseCase } from '../../finance-category/use-case/delete-finance-category.use-case.js';
import { CreateFinanceCategoryGroupDto } from '../../finance-category-group/dto/create-finance-category-group.dto.js';
import { UpdateFinanceCategoryGroupDto } from '../../finance-category-group/dto/update-finance-category-group.dto.js';
import { CreateFinanceCategoryGroupUseCase } from '../../finance-category-group/use-case/create-finance-category-group.use-case.js';
import { UpdateFinanceCategoryGroupUseCase } from '../../finance-category-group/use-case/update-finance-category-group.use-case.js';
import { DeleteFinanceCategoryGroupUseCase } from '../../finance-category-group/use-case/delete-finance-category-group.use-case.js';
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
import {
  NodiaAiFinanceCatalogService,
  type FinanceCatalogResource,
} from '../nodia-ai-finance-catalog.service.js';

type Operation = 'create' | 'update' | 'delete';
type CatalogDto =
  | CreateFinanceCategoryDto
  | UpdateFinanceCategoryDto
  | CreateFinanceCategoryGroupDto
  | UpdateFinanceCategoryGroupDto;
interface Decoded {
  ownerId: string;
  id?: string;
  command: NodiaAiJsonObject;
  origins: NodiaAiJsonObject;
}
type Writer = (
  actor: FinanceActor,
  input: Decoded,
) => Promise<{ id: string; user_id: string } | void>;
const route = '/tools/finances-personal';
const scalarFields = {
  name: 'string',
  key: 'string',
  is_active: 'boolean',
} as const;
const invalid = (): never => {
  throw new BadRequestException('nodia_ai:invalid_input');
};
const object = (value: NodiaAiJsonValue | undefined): NodiaAiJsonObject => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid();
  return value;
};
const reviewArray = (items: NodiaAiJsonValue[]): NodiaAiJsonObject => ({
  kind: 'array',
  items,
});
const reviewObject = (value: NodiaAiJsonObject): NodiaAiJsonObject => ({
  kind: 'object',
  fields: Object.entries(value).map(([field_key, item]) => ({
    field_key,
    value: item,
  })),
});

/** A closed resource/operation registration, not a generic SQL or arbitrary DTO adapter. */
class FinanceCatalogOperation implements NodiaAiFinanceOperation {
  readonly toolName: string;
  readonly contractHash: string;
  readonly catalogVersion = 'nodia-ai-ai21-finance/1';
  readonly moduleRoutes = [route];
  readonly actionKeys: readonly string[] = [];
  readonly editableFields: Readonly<Record<string, string>>;
  readonly bindableFields: Readonly<Record<string, string>> = {};
  readonly outputKeys: Readonly<Record<string, string>>;
  readonly reviewFields: readonly NodiaAiProposalReviewField[];
  private readonly group: boolean;
  constructor(
    readonly resourceKey: FinanceCatalogResource,
    readonly operation: Operation,
    private readonly scopeService: FinanceCategoryService,
    private readonly store: NodiaAiFinanceCatalogService,
    private readonly writer: Writer,
  ) {
    this.group = resourceKey === 'finance_category_groups';
    this.toolName = `nodia_${resourceKey}_prepare_${operation}`;
    this.editableFields =
      operation === 'delete'
        ? {}
        : this.group
          ? { ...scalarFields, category_ids: 'finance_category_ids' }
          : scalarFields;
    this.outputKeys =
      operation === 'delete'
        ? {}
        : {
            id: this.group
              ? 'finance_category_group_id'
              : 'finance_category_id',
          };
    this.contractHash = createHash('sha256')
      .update(
        JSON.stringify({
          version: 'nodia-ai-finance-catalog/1',
          resourceKey,
          operation,
          fields: this.editableFields,
          required:
            operation === 'create'
              ? this.group
                ? ['name', 'key', 'category_ids']
                : ['name', 'key']
              : ['id'],
          defaults: operation === 'create' ? { is_active: true } : {},
          target: 'top_level_id_immutable/1',
          nativeValidation: this.group
            ? 'FinanceCategoryGroupDtos+syncFinanceGroupCategories/1'
            : 'FinanceCategoryDtos/1',
          preconditions:
            'target_exact_values_timestamp+key_unique+locked_membership_selection_metadata/1',
          deletion: this.group
            ? 'memberships_only_categories_preserved/1'
            : 'no_movements+remove_all_memberships/1',
        }),
      )
      .digest('hex');
    this.reviewFields =
      operation === 'delete'
        ? []
        : Object.keys(scalarFields).map((field_key) => ({
            field_key,
            label_key:
              field_key === 'is_active'
                ? 'finance:active'
                : `finance:${field_key}`,
            kind: field_key === 'is_active' ? 'boolean' : 'text',
            nullable: false,
            max_length: field_key === 'is_active' ? null : 255,
            minimum: null,
            maximum: null,
            options: [],
          }));
  }

  private dto(command: NodiaAiJsonObject, partial: boolean): CatalogDto {
    let value: CatalogDto;
    if (this.group)
      value =
        this.operation === 'create'
          ? plainToInstance(CreateFinanceCategoryGroupDto, command)
          : plainToInstance(UpdateFinanceCategoryGroupDto, command);
    else
      value =
        this.operation === 'create'
          ? plainToInstance(CreateFinanceCategoryDto, command)
          : plainToInstance(UpdateFinanceCategoryDto, command);
    if (
      validateSync(value, {
        whitelist: true,
        forbidNonWhitelisted: true,
        skipUndefinedProperties: partial,
      }).length
    )
      return invalid();
    return value;
  }

  private decode(
    input: NodiaAiJsonObject,
    context: ProposalPreparerContext,
  ): Decoded {
    let owner: NodiaAiJsonValue | undefined;
    let id: NodiaAiJsonValue | undefined;
    let command: NodiaAiJsonObject;
    let origins: NodiaAiJsonObject;
    if ('schema_version' in input) {
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
      owner = input.owner_id;
      id = input.id;
      command = { ...object(input.command) };
      origins = { ...object(input.origins) };
      if (
        Object.keys(origins).some((key) => !Object.hasOwn(command, key)) ||
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
            key === 'is_active' &&
            command[key] === true
          )
        )
          return invalid();
      }
    } else {
      const { owner_id, id: target, ...fields } = input;
      owner = owner_id === undefined ? context.actor.actorId : owner_id;
      id = target;
      command = fields;
      origins = Object.fromEntries(
        Object.keys(command).map((key) => [key, 'user']),
      );
    }
    if (
      !isFinanceBigint(owner) ||
      Object.values(command).some((value) => value === undefined) ||
      (id !== undefined && !isFinanceBigint(id)) ||
      (this.operation === 'create' && id !== undefined) ||
      Object.keys(command).some(
        (key) => !Object.hasOwn(this.editableFields, key),
      )
    )
      return invalid();
    if (this.operation !== 'delete') {
      const dto = this.dto(command, true);
      for (const key of Object.keys(command))
        command[key] = (dto as unknown as NodiaAiJsonObject)[key];
    }
    return {
      ownerId: owner,
      ...(id === undefined ? {} : { id }),
      command,
      origins,
    };
  }

  private template(input: Decoded): NodiaAiJsonObject {
    return {
      schema_version: 1,
      owner_id: input.ownerId,
      ...(input.id === undefined ? {} : { id: input.id }),
      command: input.command,
      origins: input.origins,
    };
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
              owner_id: previous.ownerId,
              ...(Object.hasOwn(partial, 'id')
                ? {}
                : previous.id
                  ? { id: previous.id }
                  : {}),
            },
        context,
      );
      if (
        (Object.hasOwn(partial, 'owner_id') &&
          partial.owner_id !== previous.ownerId) ||
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
    return this.scopeService.withScope(
      this.actor(decoded.ownerId, context),
      async ({ ownerId }) => {
        const required =
          this.operation === 'create'
            ? this.group
              ? ['name', 'key', 'category_ids']
              : ['name', 'key']
            : [];
        const missingFields = required.filter(
          (key) => !Object.hasOwn(decoded.command, key),
        );
        if (this.operation !== 'create' && decoded.id === undefined)
          missingFields.push('id');
        if (
          this.operation === 'update' &&
          Object.keys(decoded.command).length === 0
        )
          missingFields.push('changes');
        if (missingFields.length)
          return {
            status: 'needs_clarification',
            partial: this.template(decoded),
            missingFields,
            clarificationKeys: missingFields.map(
              (key) => `nodia_ai:finance_catalog_${key}_required`,
            ),
          };
        if (this.operation !== 'delete') this.dto(decoded.command, false);
        if (
          this.operation === 'create' &&
          !Object.hasOwn(decoded.command, 'is_active')
        ) {
          decoded.command.is_active = true;
          decoded.origins.is_active = 'contract_default';
        }
        const preconditions = await this.snapshot(decoded, context);
        const target =
          preconditions.target === null ? null : object(preconditions.target);
        const changes: NodiaAiJsonObject[] = [];
        const keys =
          this.operation === 'delete'
            ? Object.keys(scalarFields)
            : Object.keys(decoded.command);
        for (const key of keys) {
          const categoryIds = key === 'category_ids';
          const before = target
            ? categoryIds
              ? reviewArray(
                  (preconditions.memberships as NodiaAiJsonObject[])
                    .filter((membership) => membership.is_active === true)
                    .map((membership) => membership.category_id),
                )
              : target[key]
            : null;
          const after =
            this.operation === 'delete'
              ? null
              : categoryIds
                ? reviewArray(
                    decoded.command.category_ids as NodiaAiJsonValue[],
                  )
                : decoded.command[key];
          changes.push({
            field_key: key,
            before,
            before_present: target !== null,
            after,
            after_present: this.operation !== 'delete',
            origin: decoded.origins[key] ?? 'user',
          });
        }
        if (this.operation === 'delete')
          changes.push({
            field_key: 'memberships',
            before: reviewArray(
              (preconditions.memberships as NodiaAiJsonObject[]).map(
                (membership) =>
                  reviewObject({
                    category_group_id: membership.category_group_id,
                    category_id: membership.category_id,
                    is_active: membership.is_active,
                  }),
              ),
            ),
            before_present: true,
            after: null,
            after_present: false,
            origin: 'database',
          });
        if (
          this.group &&
          Array.isArray(preconditions.categories) &&
          preconditions.categories.length
        )
          changes.push({
            field_key: 'category_references',
            before: null,
            before_present: false,
            after: reviewArray(
              (preconditions.categories as NodiaAiJsonObject[]).map(
                (category) =>
                  reviewObject({
                    id: category.id,
                    name: category.name,
                    key: category.key,
                    is_active: category.is_active,
                  }),
              ),
            ),
            after_present: true,
            origin: 'database',
          });
        const scope = { subject_user_id: ownerId };
        return {
          status: 'ready',
          commandTemplate: this.template(decoded),
          scope,
          preconditions,
          publicStep: {
            tool_name: this.toolName,
            kind: 'domain_change',
            target: target
              ? {
                  resource_key: this.resourceKey,
                  id: decoded.id!,
                  label: String(target.name),
                }
              : null,
            scope,
            changes,
            depends_on: [],
            effect_key: `${this.group ? 'finance_category_group' : 'finance_category'}.${this.operation}`,
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
      if (
        !Object.hasOwn(this.editableFields, edit.field_key) ||
        seen.has(edit.field_key)
      )
        return invalid();
      seen.add(edit.field_key);
      decoded.command[edit.field_key] = edit.value;
      decoded.origins[edit.field_key] = 'user';
    }
    const valid = this.decode(this.template(decoded), context);
    await this.scopeService.withScope(
      this.actor(valid.ownerId, context),
      async () => undefined,
    );
    return this.template(valid);
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
    // Historical receipts remain readable after target deletion or later edits.
    await this.scopeService.withScope(
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
    await this.scopeService.withScope(
      this.actor(decoded.ownerId, context),
      async () => {
        let current: NodiaAiJsonObject;
        try {
          current = await this.snapshot(decoded, context);
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

  async executeConfirmed(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<{ id: string; ownerId: string }> {
    const template = step.commandTemplate;
    const decoded = this.decode(template, context);
    if (
      !isDeepStrictEqual(template, this.template(decoded)) ||
      (this.operation !== 'create' && !decoded.id) ||
      step.outputBindings.length ||
      !Array.isArray(step.publicStep.depends_on) ||
      step.publicStep.depends_on.length ||
      Object.keys(decoded.command).length !==
        Object.keys(decoded.origins).length ||
      Object.keys(decoded.command).some(
        (key) => !Object.hasOwn(decoded.origins, key),
      )
    )
      return invalid();
    if (
      (this.operation === 'create' &&
        !Object.hasOwn(decoded.command, 'is_active')) ||
      (this.operation === 'update' && !Object.keys(decoded.command).length)
    )
      return invalid();
    if (this.operation !== 'delete') this.dto(decoded.command, false);
    await this.verifyPreconditions(step, context);
    const response = await this.writer(
      this.actor(decoded.ownerId, context),
      decoded,
    );
    const id = this.operation === 'delete' ? decoded.id : response?.id;
    if (
      !isFinanceBigint(id) ||
      (response && response.user_id !== decoded.ownerId)
    )
      throw new InternalServerErrorException('nodia_ai:invalid_output');
    return { id, ownerId: decoded.ownerId };
  }

  private async snapshot(
    input: Decoded,
    context: ProposalPreparerContext,
  ): Promise<NodiaAiJsonObject> {
    const { manager } = context;
    const target =
      this.operation === 'create'
        ? null
        : await this.store.target(
            manager,
            this.resourceKey,
            input.ownerId,
            input.id!,
          );
    if (this.operation !== 'create' && !target)
      throw new NotFoundException(
        this.group
          ? 'finance:category_group_not_found'
          : 'finance:category_not_found',
      );
    if (
      input.command.key !== undefined &&
      (await this.store.duplicate(
        manager,
        this.resourceKey,
        input.ownerId,
        String(input.command.key),
        input.id ?? null,
      ))
    )
      throw new ConflictException('finance:duplicate_key');
    const snapshot: NodiaAiJsonObject = {
      schema_version: 1,
      target,
      memberships: [],
      categories: [],
    };
    if (!this.group) {
      if (this.operation === 'delete') {
        if (await this.store.hasMovements(manager, input.ownerId, input.id!))
          throw new ConflictException('finance:category_has_movements');
        snapshot.memberships = await this.boundedMemberships(input, context);
      }
      return snapshot;
    }
    const selected = (input.command.category_ids ?? []) as string[];
    // Same native order: group -> categories (ascending) -> membership rows.
    // The preliminary membership read does not lock rows before category locks.
    const before = input.id
      ? await this.boundedMemberships(input, context, false)
      : [];
    const ids = [
      ...new Set([
        ...selected,
        ...before.map((item) => String(item.category_id)),
      ]),
    ];
    const categories = ids.length
      ? await this.store.categories(manager, input.ownerId, ids)
      : [];
    if (categories.length !== ids.length)
      throw new NotFoundException('finance:category_not_found');
    const memberships = input.id
      ? await this.boundedMemberships(input, context)
      : [];
    const existing = new Set(
      memberships
        .filter((item) => item.is_active === true)
        .map((item) => item.category_id),
    );
    for (const category of categories)
      if (
        selected.includes(String(category.id)) &&
        category.is_active !== true &&
        !existing.has(category.id)
      )
        throw new ConflictException('finance:category_inactive');
    snapshot.memberships = memberships;
    snapshot.categories = categories;
    return snapshot;
  }

  private async boundedMemberships(
    input: Decoded,
    context: ProposalPreparerContext,
    lock = true,
  ): Promise<NodiaAiJsonObject[]> {
    const maximum = context.maxCollectionItems ?? 100;
    const memberships = await this.store.memberships(
      context.manager,
      this.resourceKey,
      input.ownerId,
      input.id!,
      maximum + 1,
      (input.command.category_ids ?? []) as string[],
      this.operation === 'delete',
      lock,
    );
    if (memberships.length > maximum)
      throw new ConflictException('nodia_ai:result_too_large');
    return memberships;
  }
}

/** Six explicit registrations reuse the exact native writers and the caller's transaction. */
@Injectable()
export class BuildNodiaAiFinanceCatalogOperationsUseCase {
  readonly operations: readonly NodiaAiFinanceOperation[];
  constructor(
    scope: FinanceCategoryService,
    store: NodiaAiFinanceCatalogService,
    createCategory: CreateFinanceCategoryUseCase,
    updateCategory: UpdateFinanceCategoryUseCase,
    deleteCategory: DeleteFinanceCategoryUseCase,
    createGroup: CreateFinanceCategoryGroupUseCase,
    updateGroup: UpdateFinanceCategoryGroupUseCase,
    deleteGroup: DeleteFinanceCategoryGroupUseCase,
  ) {
    this.operations = Object.freeze([
      new FinanceCatalogOperation(
        'finance_categories',
        'create',
        scope,
        store,
        (actor, input) =>
          createCategory.execute(
            actor,
            plainToInstance(CreateFinanceCategoryDto, input.command),
          ),
      ),
      new FinanceCatalogOperation(
        'finance_categories',
        'update',
        scope,
        store,
        (actor, input) =>
          updateCategory.execute(
            actor,
            input.id!,
            plainToInstance(UpdateFinanceCategoryDto, input.command),
          ),
      ),
      new FinanceCatalogOperation(
        'finance_categories',
        'delete',
        scope,
        store,
        (actor, input) => deleteCategory.execute(actor, input.id!),
      ),
      new FinanceCatalogOperation(
        'finance_category_groups',
        'create',
        scope,
        store,
        (actor, input) =>
          createGroup.execute(
            actor,
            plainToInstance(CreateFinanceCategoryGroupDto, input.command),
          ),
      ),
      new FinanceCatalogOperation(
        'finance_category_groups',
        'update',
        scope,
        store,
        (actor, input) =>
          updateGroup.execute(
            actor,
            input.id!,
            plainToInstance(UpdateFinanceCategoryGroupDto, input.command),
          ),
      ),
      new FinanceCatalogOperation(
        'finance_category_groups',
        'delete',
        scope,
        store,
        (actor, input) => deleteGroup.execute(actor, input.id!),
      ),
    ]);
  }
}
