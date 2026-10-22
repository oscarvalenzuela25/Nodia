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
import {
  currentActor,
  lockAuthority,
} from '../../authorization/authority-transaction.js';
import {
  assertCoreAuthorityTransaction,
  isCoreAuthorityTransaction,
} from '../../authorization/core-authority-transaction.js';
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
import { CreateUserDto } from '../../user/dto/create-user.dto.js';
import { UpdateUserDto } from '../../user/dto/update-user.dto.js';
import { CreateRoleDto } from '../../role/dto/create-role.dto.js';
import { UpdateRoleDto } from '../../role/dto/update-role.dto.js';
import { CreateActionDto } from '../../action/dto/create-action.dto.js';
import { UpdateActionDto } from '../../action/dto/update-action.dto.js';
import { CreateBusinessActionDto } from '../../business-action/dto/create-business-action.dto.js';
import { UpdateBusinessActionDto } from '../../business-action/dto/update-business-action.dto.js';
import { CreateModuleDto } from '../../module/dto/create-module.dto.js';
import { UpdateModuleDto } from '../../module/dto/update-module.dto.js';
import { CreateModuleGroupDto } from '../../module-group/dto/create-module-group.dto.js';
import { UpdateModuleGroupDto } from '../../module-group/dto/update-module-group.dto.js';
import { SaveUserUseCase } from '../../user/use-case/save-user.use-case.js';
import { SaveRoleUseCase } from '../../role/use-case/save-role.use-case.js';
import { SaveActionUseCase } from '../../action/use-case/save-action.use-case.js';
import { SaveModuleUseCase } from '../../module/use-case/save-module.use-case.js';
import { SaveModuleGroupUseCase } from '../../module-group/use-case/save-module-group.use-case.js';
import { DeleteRoleUseCase } from '../../role/use-case/delete-role.use-case.js';
import { DeleteActionUseCase } from '../../action/use-case/delete-action.use-case.js';
import { DeleteModuleUseCase } from '../../module/use-case/delete-module.use-case.js';
import { DeleteModuleGroupUseCase } from '../../module-group/use-case/delete-module-group.use-case.js';
import { CreateBusinessActionUseCase } from '../../business-action/use-case/create-business-action.use-case.js';
import { UpdateBusinessActionUseCase } from '../../business-action/use-case/update-business-action.use-case.js';
import { DeleteBusinessActionUseCase } from '../../business-action/use-case/delete-business-action.use-case.js';
import { NodiaAiCoreOperationsService } from '../nodia-ai-core-operations.service.js';
import type {
  NodiaAiCoreResource as Resource,
  NodiaAiCoreAction as Action,
  NodiaAiCoreOperation,
} from '../types/core-operation.types.js';

const fields: Record<Resource, Readonly<Record<string, string>>> = {
  users: {
    name: 'nullable_string',
    email: 'string',
    image_url: 'nullable_string',
    is_active: 'boolean',
    roles: 'id_list',
    modules: 'id_list',
  },
  roles: {
    key: 'string',
    is_active: 'boolean',
    actions: 'id_list',
    translates: 'translations',
  },
  actions: {
    key: 'string',
    description: 'nullable_string',
    is_active: 'boolean',
    translates: 'translations',
  },
  business_actions: {
    key: 'string',
    has_description: 'boolean',
    is_active: 'boolean',
    translates: 'translations',
  },
  modules: {
    key: 'string',
    module_group_id: 'id',
    link: 'string',
    icon: 'nullable_string',
    is_active: 'boolean',
    translates: 'translations',
  },
  module_groups: {
    key: 'string',
    icon: 'nullable_string',
    is_active: 'boolean',
    translates: 'translations',
  },
};
const routes: Record<Resource, string> = {
  users: '/settings/users',
  roles: '/settings/roles',
  actions: '/settings/actions',
  business_actions: '/settings/actions',
  modules: '/settings/modules',
  module_groups: '/settings/modules',
};
const dtoClasses = {
  users: [CreateUserDto, UpdateUserDto],
  roles: [CreateRoleDto, UpdateRoleDto],
  actions: [CreateActionDto, UpdateActionDto],
  business_actions: [CreateBusinessActionDto, UpdateBusinessActionDto],
  modules: [CreateModuleDto, UpdateModuleDto],
  module_groups: [CreateModuleGroupDto, UpdateModuleGroupDto],
};
interface Input {
  id?: string;
  command: NodiaAiJsonObject;
  origins: NodiaAiJsonObject;
}
type Writer = (
  input: Input,
  context: ProposalPreparerContext,
  resolvedId?: string,
) => Promise<{ id: string }>;
const invalid = (): never => {
  throw new BadRequestException('nodia_ai:invalid_input');
};
function object(value: unknown): NodiaAiJsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid();
  return value as NodiaAiJsonObject;
}
function isId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[1-9][0-9]{0,18}$/.test(value) &&
    BigInt(value) <= 9223372036854775807n
  );
}
function review(value: NodiaAiJsonValue): NodiaAiJsonValue {
  if (Array.isArray(value)) return { kind: 'array', items: value.map(review) };
  if (value !== null && typeof value === 'object')
    return {
      kind: 'object',
      fields: Object.entries(value).map(([field_key, value]) => ({
        field_key,
        value: review(value),
      })),
    };
  return value;
}
const identity = (c: ProposalPreparerContext) => ({
  userId: c.actor.actorId,
  sessionId: c.actor.sessionId,
  transaction: c.manager,
  statementTimeoutMs: c.statementTimeoutMs,
});

class CoreOperation implements NodiaAiCoreOperation {
  readonly toolName: string;
  readonly catalogVersion = 'nodia-ai-ai27-core/1';
  readonly moduleRoutes: readonly string[];
  readonly actionKeys: readonly string[] = [];
  readonly bindableFields: Readonly<Record<string, string>> = {};
  readonly outputKeys: Readonly<Record<string, string>>;
  readonly editableFields: Readonly<Record<string, string>>;
  readonly reviewFields: readonly NodiaAiProposalReviewField[];
  readonly contractHash: string;
  constructor(
    readonly resourceKey: Resource,
    readonly operation: Action,
    private readonly store: NodiaAiCoreOperationsService,
    private readonly writer: Writer,
  ) {
    this.toolName = `nodia_${resourceKey}_prepare_${operation}`;
    this.moduleRoutes = [routes[resourceKey]];
    this.outputKeys = {
      id: `${resourceKey === 'users' ? 'user' : resourceKey === 'roles' ? 'role' : resourceKey === 'actions' ? 'action' : resourceKey === 'business_actions' ? 'business_action' : resourceKey === 'modules' ? 'module' : 'module_group'}_id`,
    };
    this.editableFields = operation === 'delete' ? {} : fields[resourceKey];
    this.reviewFields = Object.entries(this.editableFields).map(
      ([field_key, type]) => ({
        field_key,
        label_key: `nodiaAi:proposal.core_fields.${field_key}`,
        kind:
          type === 'id_list'
            ? 'core_id_list'
            : type === 'translations'
              ? 'core_translations'
              : type === 'boolean'
                ? 'boolean'
                : type === 'id'
                  ? 'bigint'
                  : 'text',
        nullable: type.startsWith('nullable_'),
        max_length: type.includes('string')
          ? field_key === 'description'
            ? 5000
            : field_key === 'image_url'
              ? 2048
              : 255
          : null,
        minimum:
          type === 'id'
            ? '1'
            : ['id_list', 'translations'].includes(type)
              ? '0'
              : null,
        maximum:
          type === 'id'
            ? '9223372036854775807'
            : ['id_list', 'translations'].includes(type)
              ? '100'
              : null,
        options: [],
      }),
    );
    this.contractHash = createHash('sha256')
      .update(
        JSON.stringify({
          catalog: this.catalogVersion,
          resourceKey,
          operation,
          fields: this.editableFields,
          template: 1,
          preconditions: 'core-material-associations-access/1',
          frontier: 'exclusive-before-first-read/1',
        }),
      )
      .digest('hex');
  }
  private template(i: Input): NodiaAiJsonObject {
    return {
      schema_version: 1,
      ...(i.id ? { id: i.id } : {}),
      command: i.command,
      origins: i.origins,
    };
  }
  private decode(raw: NodiaAiJsonObject, stored = false): Input {
    const allowed = stored
      ? ['schema_version', 'id', 'command', 'origins']
      : ['id', ...Object.keys(this.editableFields)];
    if (
      Object.keys(raw).some((key) => !allowed.includes(key)) ||
      (stored && raw.schema_version !== 1) ||
      (raw.id !== undefined && !isId(raw.id)) ||
      (this.operation === 'create' && raw.id !== undefined)
    )
      return invalid();
    const command = stored
      ? { ...object(raw.command) }
      : Object.fromEntries(Object.entries(raw).filter(([key]) => key !== 'id'));
    const origins = stored
      ? { ...object(raw.origins) }
      : Object.fromEntries(Object.keys(command).map((key) => [key, 'user']));
    if (
      Object.keys(command).some(
        (key) => !Object.hasOwn(this.editableFields, key),
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
    for (const [key, value] of Object.entries(command)) {
      const type = this.editableFields[key];
      if (value === null && type.startsWith('nullable_')) continue;
      if (type === 'boolean' && typeof value !== 'boolean') return invalid();
      if (
        type.includes('string') &&
        (typeof value !== 'string' ||
          value.length >
            (key === 'description' ? 5000 : key === 'image_url' ? 2048 : 255))
      )
        return invalid();
      if (type === 'id' && !isId(value)) return invalid();
      if (type === 'id_list') {
        if (
          !Array.isArray(value) ||
          value.length > 100 ||
          value.some(
            (v) =>
              typeof v !== 'string' ||
              v.length > 255 ||
              (key !== 'actions' && !isId(v)) ||
              (key === 'actions' && /^\d+$/.test(v) && !isId(v)),
          )
        )
          return invalid();
        command[key] = [...new Set(value as string[])].sort();
      }
      if (type === 'translations') {
        if (!Array.isArray(value) || value.length > 100) return invalid();
        const keys = new Set<string>();
        for (const item of value) {
          const row = object(item);
          if (
            Object.keys(row).sort().join(',') !== 'en,es,key' ||
            ['key', 'es', 'en'].some(
              (k) =>
                typeof row[k] !== 'string' ||
                !row[k] ||
                Buffer.byteLength(String(row[k]), 'utf8') >
                  (k === 'key' ? 255 : 5000),
            ) ||
            keys.has(String(row.key))
          )
            return invalid();
          keys.add(String(row.key));
        }
        command[key] = [...value].sort((a, b) =>
          String(object(a).key).localeCompare(String(object(b).key)),
        );
      }
    }
    if (typeof command.email === 'string')
      command.email = command.email.trim().toLowerCase();
    if (this.operation !== 'delete') {
      const Dto = dtoClasses[this.resourceKey][
        this.operation === 'create' ? 0 : 1
      ] as new () => object;
      if (
        validateSync(plainToInstance(Dto, command), {
          whitelist: true,
          forbidNonWhitelisted: true,
          forbidUnknownValues: true,
          skipMissingProperties: true,
        }).length
      )
        return invalid();
    }
    return { id: raw.id as string | undefined, command, origins };
  }
  private async authority(c: ProposalPreparerContext) {
    if (
      !c.manager.queryRunner?.isTransactionActive ||
      !c.moduleRoutes.includes(routes[this.resourceKey])
    )
      throw new ForbiddenException('nodia_ai:capability_denied');
    if (!isCoreAuthorityTransaction(c.manager))
      await lockAuthority(c.manager, false, c.statementTimeoutMs);
    return currentActor(c.manager, identity(c));
  }
  async prepare(
    raw: NodiaAiJsonObject,
    c: ProposalPreparerContext,
    previous?: NodiaAiJsonObject,
  ): Promise<ProposalPreparation> {
    const i = this.decode(raw),
      old = previous ? this.decode(previous, true) : null;
    if (old) {
      if (i.id && old.id && i.id !== old.id) return invalid();
      i.id ??= old.id;
      i.command = { ...old.command, ...i.command };
      i.origins = { ...old.origins, ...i.origins };
    }
    return this.prepareInput(i, c);
  }
  reprepareStored(template: NodiaAiJsonObject, c: ProposalPreparerContext) {
    return this.prepareInput(this.decode(template, true), c);
  }
  private async prepareInput(
    i: Input,
    c: ProposalPreparerContext,
  ): Promise<ProposalPreparation> {
    await this.authority(c);
    const missing: string[] = [];
    if (this.operation !== 'create' && !i.id) missing.push('id');
    if (this.operation === 'create')
      for (const key of this.resourceKey === 'users'
        ? ['email']
        : this.resourceKey === 'modules'
          ? ['key', 'module_group_id', 'link']
          : ['key'])
        if (!Object.hasOwn(i.command, key)) missing.push(key);
    if (this.operation === 'update' && !Object.keys(i.command).length)
      missing.push('changes');
    if (missing.length)
      return {
        status: 'needs_clarification',
        partial: this.template(i),
        missingFields: missing,
        clarificationKeys: missing.map((k) => `nodia_ai:core_${k}_required`),
      };
    // Resolve native upsert before choosing defaults: omitted values on an existing record stay untouched.
    const existing = await this.store.target(
      c.manager,
      this.resourceKey,
      i.id,
      this.identityValue(i),
    );
    if (this.operation === 'create' && !existing) {
      const defaults: NodiaAiJsonObject = {
        is_active: true,
        ...(this.resourceKey === 'business_actions'
          ? { has_description: false }
          : {}),
        ...(this.resourceKey === 'users'
          ? { name: null, image_url: null, roles: [], modules: [] }
          : this.resourceKey === 'roles'
            ? { actions: [], translates: [] }
            : this.resourceKey === 'actions'
              ? { description: null, translates: [] }
              : ['modules', 'module_groups'].includes(this.resourceKey)
                ? { icon: null, translates: [] }
                : { translates: [] }),
      };
      for (const [key, value] of Object.entries(defaults))
        if (!Object.hasOwn(i.command, key)) {
          i.command[key] = value;
          i.origins[key] = 'contract_default';
        }
    }
    if (existing && Array.isArray(i.command.translates)) {
      const translations = await this.store.translations(
        c.manager,
        this.resourceKey,
        String(existing.id),
      );
      if (!i.command.translates.length && translations.length)
        throw new BadRequestException(
          'nodia_ai:core_translation_removal_unsupported',
        );
      const merged = new Map(translations.map((row) => [String(row.key), row]));
      for (const row of i.command.translates)
        merged.set(String(object(row).key), object(row));
      i.command.translates = [...merged.values()].sort((a, b) =>
        String(a.key).localeCompare(String(b.key)),
      );
      this.decode(this.template(i), true);
    }
    await this.resolveAssociations(i, c);
    const preconditions = await this.snapshot(i, c),
      target =
        preconditions.target === null ? null : object(preconditions.target);
    const associations = object(preconditions.associations);
    const changes = Object.entries(i.command).map(([field_key, value]) => ({
      field_key,
      before: target
        ? review(
            field_key === 'translates'
              ? preconditions.translations
              : associations[field_key] !== undefined
                ? (associations[field_key] as NodiaAiJsonObject[]).map(
                    (row) => row.id,
                  )
                : (target[field_key] ?? null),
          )
        : null,
      before_present: target !== null,
      after: review(value),
      after_present: true,
      origin: i.origins[field_key],
    }));
    const derived: NodiaAiJsonObject = {
      ...(this.operation === 'create'
        ? { resolved_existing: target !== null }
        : {}),
      ...object(preconditions.related),
      access_impact: preconditions.access_impact,
    };
    if (this.operation === 'delete')
      derived.deletion_mode =
        this.resourceKey === 'business_actions' ? 'deactivate' : 'delete';
    if (this.operation === 'delete' && this.resourceKey === 'business_actions')
      derived.is_active = false;
    for (const [field_key, value] of Object.entries(derived))
      changes.push({
        field_key,
        before:
          target && Object.hasOwn(target, field_key)
            ? review(target[field_key])
            : null,
        before_present: target !== null && Object.hasOwn(target, field_key),
        after: review(value),
        after_present: true,
        origin: 'database',
      });
    return {
      status: 'ready',
      commandTemplate: this.template(i),
      scope: {},
      preconditions,
      publicStep: {
        tool_name: this.toolName,
        kind: 'domain_change',
        target: target
          ? {
              resource_key: this.resourceKey,
              id: String(target.id),
              label: String(target.email ?? target.key ?? target.id),
            }
          : null,
        scope: {},
        changes,
        depends_on: [],
        effect_key: `${this.resourceKey}.${this.operation}`,
        output_bindings: [],
      },
    };
  }
  private identityValue(i: Input): string | undefined {
    const value = i.command[this.resourceKey === 'users' ? 'email' : 'key'];
    return this.operation === 'create' && typeof value === 'string'
      ? value
      : undefined;
  }
  private async resolveAssociations(i: Input, c: ProposalPreparerContext) {
    for (const key of ['roles', 'modules', 'actions'] as const)
      if (i.command[key] !== undefined) {
        const values = i.command[key] as string[];
        const rows =
          key === 'actions'
            ? await this.store.actionKeys(c.manager, values)
            : await this.store.catalog(c.manager, key, values);
        const ids = new Map<string, string>();
        const keys = new Map<string, string>();
        for (const row of rows) {
          ids.set(String(row.id), String(row.id));
          keys.set(String(row.label), String(row.id));
        }
        const resolved = values.map((v) =>
          /^\d+$/.test(v) ? ids.get(v) : keys.get(v),
        );
        if (resolved.some((v) => v === undefined))
          throw new BadRequestException(
            key === 'actions'
              ? 'roles:invalid_actions'
              : 'users:invalid_associations',
          );
        i.command[key] = [...new Set(resolved as string[])].sort((a, b) =>
          BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0,
        );
      }
  }
  private async snapshot(
    i: Input,
    c: ProposalPreparerContext,
  ): Promise<NodiaAiJsonObject> {
    const target = await this.store.target(
      c.manager,
      this.resourceKey,
      i.id,
      this.identityValue(i),
    );
    if (this.operation !== 'create' && !target)
      throw new NotFoundException('nodia_ai:domain_target_not_found');
    if (this.resourceKey === 'roles') {
      if (!target && i.command.key === 'super_admin')
        throw new ForbiddenException('roles:protected_role');
      if (
        target?.key === 'super_admin' &&
        (this.operation === 'delete' || i.command.is_active === false)
      )
        throw new ForbiddenException('roles:protected_role');
      if (
        target?.key === 'super_admin' &&
        i.command.key !== undefined &&
        i.command.key !== target.key
      )
        throw new ForbiddenException('roles:protected_key');
    }
    if (
      this.resourceKey === 'modules' &&
      target &&
      i.command.key !== undefined &&
      i.command.key !== target.key
    )
      throw new ForbiddenException('modules:immutable_key');
    if (
      this.operation === 'update' &&
      i.command[this.resourceKey === 'users' ? 'email' : 'key'] !== undefined
    ) {
      const collision = await this.store.target(
        c.manager,
        this.resourceKey,
        undefined,
        String(i.command[this.resourceKey === 'users' ? 'email' : 'key']),
      );
      if (collision && collision.id !== target?.id)
        throw new ConflictException('nodia_ai:preconditions_changed');
    }
    const associations = target
      ? await this.store.associations(
          c.manager,
          this.resourceKey,
          String(target.id),
        )
      : {};
    const translations = target
      ? await this.store.translations(
          c.manager,
          this.resourceKey,
          String(target.id),
        )
      : [];
    if (translations.length > 100)
      throw new ConflictException('nodia_ai:result_too_large');
    const related: NodiaAiJsonObject = {};
    for (const key of ['roles', 'modules', 'actions'] as const) {
      if (i.command[key] === undefined && associations[key] === undefined)
        continue;
      const rows =
        i.command[key] !== undefined
          ? await this.store.catalog(c.manager, key, i.command[key] as string[])
          : (associations[key] as NodiaAiJsonObject[]);
      if (
        i.command[key] !== undefined &&
        rows.length !== (i.command[key] as string[]).length
      )
        throw new BadRequestException('users:invalid_associations');
      related[`${key}_details`] = rows;
    }
    const groupId = i.command.module_group_id ?? target?.module_group_id;
    if (groupId !== undefined) {
      const rows = await this.store.catalog(c.manager, 'module_groups', [
        String(groupId),
      ]);
      if (!rows[0]) throw new BadRequestException('modules:groups.not_found');
      related.module_group_details = rows[0];
    }
    let groupModules: NodiaAiJsonObject[] = [];
    if (this.resourceKey === 'module_groups' && target) {
      groupModules = await this.store.groupModules(
        c.manager,
        String(target.id),
      );
      if (this.operation === 'delete' && groupModules.length)
        throw new ConflictException('modules:groups.delete_has_modules');
      related.group_modules = groupModules;
    }
    const users = target
      ? await this.store.affectedUsers(
          c.manager,
          this.resourceKey,
          String(target.id),
        )
      : [];
    const removed: NodiaAiJsonObject = {};
    for (const key of ['roles', 'modules', 'actions'])
      if (associations[key] !== undefined) {
        const before = associations[key] as NodiaAiJsonObject[],
          after = i.command[key] as string[] | undefined;
        removed[key] = before.filter(
          (row) =>
            this.operation === 'delete' ||
            i.command.is_active === false ||
            (after !== undefined && !after.includes(String(row.id))),
        );
      }
    let admins: NodiaAiJsonObject[] = [];
    if (this.resourceKey === 'users' && target?.is_active === true) {
      const before = associations.roles as NodiaAiJsonObject[];
      const superRole = before.find(
        (row) =>
          row.label === 'super_admin' &&
          row.is_active === true &&
          row.assignment_active === true,
      );
      if (
        superRole &&
        (i.command.is_active === false ||
          (Array.isArray(i.command.roles) &&
            !i.command.roles.includes(superRole.id)))
      ) {
        admins = await this.store.superAdmins(c.manager);
        if (admins.length === 1 && admins[0].id === target.id)
          throw new ForbiddenException('users:last_super_admin');
      }
    }
    return {
      schema_version: 1,
      ...(Object.hasOwn(i.command, 'translates')
        ? { translation_semantics: 'upsert-preview/1' }
        : {}),
      target,
      identity: target?.id ?? null,
      associations,
      translations,
      related,
      access_impact: {
        affected_users: users,
        removed_roles: removed.roles ?? [],
        removed_modules: removed.modules ?? [],
        removed_actions: removed.actions ?? [],
        deactivates_access:
          this.resourceKey !== 'business_actions' &&
          (i.command.is_active === false || this.operation === 'delete'),
      },
      admins,
    };
  }
  async applyEdits(
    template: NodiaAiJsonObject,
    edits: readonly ProposalFieldEdit[],
    c: ProposalPreparerContext,
  ): Promise<NodiaAiJsonObject> {
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
    if (
      edits.some((edit) => edit.field_key === 'translates') &&
      Array.isArray(next.command.translates)
    ) {
      const keys = new Set(
        next.command.translates.map((row) => String(object(row).key)),
      );
      const target = await this.store.target(
        c.manager,
        this.resourceKey,
        next.id,
        this.identityValue(next),
      );
      const persisted = target
        ? await this.store.translations(
            c.manager,
            this.resourceKey,
            String(target.id),
          )
        : [];
      if (persisted.some((row) => !keys.has(String(row.key))))
        throw new BadRequestException(
          'nodia_ai:core_translation_removal_unsupported',
        );
    }
    return this.template(next);
  }
  async verifyAuthority(step: StoredProposalStep, c: ProposalPreparerContext) {
    this.decode(step.commandTemplate, true);
    if (
      step.toolName !== this.toolName ||
      step.contractHash !== this.contractHash ||
      !isDeepStrictEqual(step.scope, {})
    )
      throw new ForbiddenException('nodia_ai:capability_denied');
    await this.authority(c);
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
  async executeConfirmed(
    step: StoredProposalStep,
    c: ProposalPreparerContext,
  ): Promise<{ id: string }> {
    assertCoreAuthorityTransaction(c.manager);
    await this.verifyPreconditions(step, c);
    const i = this.decode(step.commandTemplate, true),
      resolved = step.preconditions.identity;
    const result = await this.writer(
      i,
      c,
      typeof resolved === 'string' ? resolved : undefined,
    );
    if (
      !isId(result.id) ||
      (i.id && result.id !== i.id) ||
      (typeof resolved === 'string' && result.id !== resolved)
    )
      throw new InternalServerErrorException('nodia_ai:invalid_effect_result');
    return { id: result.id };
  }
}

@Injectable()
export class BuildNodiaAiCoreOperationsUseCase {
  readonly operations: readonly NodiaAiCoreOperation[];
  constructor(
    store: NodiaAiCoreOperationsService,
    saveUser: SaveUserUseCase,
    saveRole: SaveRoleUseCase,
    saveAction: SaveActionUseCase,
    saveModule: SaveModuleUseCase,
    saveModuleGroup: SaveModuleGroupUseCase,
    deleteRole: DeleteRoleUseCase,
    deleteAction: DeleteActionUseCase,
    deleteModule: DeleteModuleUseCase,
    deleteModuleGroup: DeleteModuleGroupUseCase,
    createBusinessAction: CreateBusinessActionUseCase,
    updateBusinessAction: UpdateBusinessActionUseCase,
    deleteBusinessAction: DeleteBusinessActionUseCase,
  ) {
    const operations: NodiaAiCoreOperation[] = [];
    for (const resource of Object.keys(fields) as Resource[])
      for (const action of (resource === 'users'
        ? ['create', 'update']
        : ['create', 'update', 'delete']) as Action[]) {
        const writer: Writer = async (i, c, resolved) => {
          const actor = identity(c),
            id = i.id ?? resolved;
          if (action === 'delete') {
            if (resource === 'roles') await deleteRole.execute(id!, actor);
            else if (resource === 'actions')
              await deleteAction.execute(id!, actor);
            else if (resource === 'modules')
              await deleteModule.execute(id!, actor);
            else if (resource === 'module_groups')
              await deleteModuleGroup.execute(id!, actor);
            else if (resource === 'business_actions')
              await deleteBusinessAction.execute(id!, actor);
            else return invalid();
            return { id: id! };
          }
          if (resource === 'users')
            return saveUser.execute(id, i.command as UpdateUserDto, actor);
          if (resource === 'roles')
            return saveRole.execute(id, i.command as UpdateRoleDto, actor);
          if (resource === 'actions')
            return saveAction.execute(id, i.command as UpdateActionDto, actor);
          if (resource === 'modules')
            return saveModule.execute(id, i.command as UpdateModuleDto, actor);
          if (resource === 'module_groups')
            return saveModuleGroup.execute(
              id,
              i.command as UpdateModuleGroupDto,
              actor,
            );
          return id
            ? updateBusinessAction.execute(
                id,
                i.command as UpdateBusinessActionDto,
                actor,
              )
            : createBusinessAction.execute(
                i.command as unknown as CreateBusinessActionDto,
                actor,
              );
        };
        operations.push(new CoreOperation(resource, action, store, writer));
      }
    this.operations = Object.freeze(operations);
  }
}
