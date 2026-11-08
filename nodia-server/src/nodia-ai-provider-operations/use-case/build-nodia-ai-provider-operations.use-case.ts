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
import {
  currentActor,
  lockAuthority,
} from '../../authorization/authority-transaction.js';
import { isCoreAuthorityTransaction } from '../../authorization/core-authority-transaction.js';
import { hasAiProviderAuthorityLock } from '../../ai-provider/use-case/ai-provider-configuration-transaction.js';
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
import { CreateAiProviderUseCase } from '../../ai-provider/use-case/create-ai-provider.use-case.js';
import { UpdateAiProviderUseCase } from '../../ai-provider/use-case/update-ai-provider.use-case.js';
import { CreateAiProviderCatalogUseCase } from '../../ai-provider/use-case/create-ai-provider-catalog.use-case.js';
import { UpdateAiProviderCatalogUseCase } from '../../ai-provider/use-case/update-ai-provider-catalog.use-case.js';
import {
  resolveAiProviderCreate,
  resolveAiProviderUpdate,
  validateAiProviderCatalogPolicy,
} from '../../ai-provider/use-case/ai-provider-configuration.rules.js';
import type { CreateAiProviderDto } from '../../ai-provider/dto/create-ai-provider.dto.js';
import type { UpdateAiProviderDto } from '../../ai-provider/dto/update-ai-provider.dto.js';
import type { CreateAiProviderCatalogDto } from '../../ai-provider/dto/create-ai-provider-catalog.dto.js';
import type { UpdateAiProviderCatalogDto } from '../../ai-provider/dto/update-ai-provider-catalog.dto.js';
import type { AiProvider } from '../../ai-provider/entities/ai-provider.entity.js';
import type { AiProviderCatalog } from '../../ai-provider/entities/ai-provider-catalog.entity.js';
import { NodiaAiProviderOperationsService } from '../nodia-ai-provider-operations.service.js';
import type {
  NodiaAiProviderOperation,
  NodiaAiProviderResource as Resource,
} from '../types/provider-operation.types.js';
const route = '/ai-providers';
const modes = ['api_key', 'agentic'] as const;
const modelFields = ['selected_model', 'ocr_model', 'ocr_focus_model'] as const;
const connectionFields: Readonly<Record<string, string>> = {
  name: 'string',
  use_api_key: 'boolean',
  use_agentic: 'boolean',
  default_mode: 'nullable_mode',
  auto_rotate_api_keys: 'boolean',
  is_default: 'boolean',
  is_active: 'boolean',
  translates: 'translations',
};
const catalogFields: Readonly<Record<string, string>> = {
  name: 'string',
  can_use_api_key: 'boolean',
  can_use_agentic: 'boolean',
};
interface Input {
  id?: string;
  command: NodiaAiJsonObject;
  origins: NodiaAiJsonObject;
}
type Writer = (
  i: Input,
  context: ProposalPreparerContext,
  nativeCommand: NodiaAiJsonObject,
) => Promise<{
  id: string;
}>;
const invalid = (): never => {
  throw new BadRequestException('nodia_ai:invalid_input');
};
function object(value: unknown): NodiaAiJsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
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
const identity = (c: ProposalPreparerContext) => ({
  userId: c.actor.actorId,
  sessionId: c.actor.sessionId,
  transaction: c.manager,
  statementTimeoutMs: c.statementTimeoutMs,
});
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
function scopedFields(raw: unknown, mode: string): NodiaAiJsonObject {
  const fields =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as NodiaAiJsonObject)
      : {};
  const scoped = fields[mode];
  if (scoped && typeof scoped === 'object' && !Array.isArray(scoped))
    return scoped;
  // Historical flat configuration belongs only to its original native mode and
  // is resolved by the caller; it must never be inherited by another channel.
  return {};
}
function modeFields(
  target: NodiaAiJsonObject | null,
  mode: string,
): NodiaAiJsonObject {
  const fields = target?.fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return {};
  const scoped = scopedFields(fields, mode);
  if (
    Object.keys(scoped).length ||
    modes.some(
      (key) =>
        fields[key] &&
        typeof fields[key] === 'object' &&
        !Array.isArray(fields[key]),
    )
  )
    return scoped;
  const historicalMode =
    target.default_mode ??
    (target.use_agentic === true
      ? 'agentic'
      : target.use_api_key === true
        ? 'api_key'
        : null);
  return historicalMode === mode ? fields : {};
}
function viewField(target: NodiaAiJsonObject, field: string): NodiaAiJsonValue {
  if (!field.includes('.')) return target[field] ?? null;
  const [mode, key] = field.split('.');
  const scoped = modeFields(target, mode);
  if (key === 'thinking_level') {
    const model = scoped.selected_model;
    const levels = scoped.thinking_levels;
    return typeof model === 'string' &&
      levels &&
      typeof levels === 'object' &&
      !Array.isArray(levels)
      ? typeof levels[model] === 'string'
        ? levels[model]
        : null
      : null;
  }
  return typeof scoped[key] === 'string' ? scoped[key] : null;
}
class ProviderOperation implements NodiaAiProviderOperation {
  readonly catalogVersion = 'nodia-ai-ai28-providers/1';
  readonly toolName: string;
  readonly moduleRoutes = [route];
  // Legacy publication metadata; role actions do not gate module-based access.
  readonly actionKeys = ['ai:manage'];
  readonly bindableFields: Readonly<Record<string, string>> = {};
  readonly outputKeys: Readonly<Record<string, string>>;
  readonly editableFields: Readonly<Record<string, string>>;
  readonly reviewFields: readonly NodiaAiProposalReviewField[];
  readonly contractHash: string;
  constructor(
    readonly resourceKey: Resource,
    readonly operation: 'create' | 'update',
    private readonly store: NodiaAiProviderOperationsService,
    private readonly writer: Writer,
  ) {
    this.toolName = `nodia_ai_providers_prepare_${resourceKey === 'ai_provider_catalog' ? 'catalog_' : ''}${operation}`;
    this.outputKeys = {
      id:
        resourceKey === 'ai_providers'
          ? 'ai_provider_id'
          : 'ai_provider_catalog_id',
    };
    this.editableFields =
      resourceKey === 'ai_provider_catalog'
        ? {
            ...catalogFields,
            ...(operation === 'create'
              ? { key: 'string' }
              : { is_active: 'boolean' }),
          }
        : {
            ...connectionFields,
            ...(operation === 'create'
              ? { catalog_id: 'id' }
              : Object.fromEntries(
                  modes.flatMap((mode) =>
                    [...modelFields, 'thinking_level'].map((key) => [
                      `${mode}.${key}`,
                      'nullable_string',
                    ]),
                  ),
                )),
          };
    this.reviewFields = Object.entries(this.editableFields).map(
      ([field_key, type]) => ({
        field_key,
        label_key: `nodiaAi:proposal.ai_provider_fields.${field_key}`,
        kind:
          type === 'boolean'
            ? 'boolean'
            : type === 'id'
              ? 'bigint'
              : type === 'nullable_mode'
                ? 'enum'
                : type === 'translations'
                  ? 'core_translations'
                  : 'text',
        nullable: type.startsWith('nullable_'),
        max_length: type.includes('string') ? this.maxLength(field_key) : null,
        minimum: type === 'id' ? '1' : type === 'translations' ? '0' : null,
        maximum:
          type === 'id'
            ? '9223372036854775807'
            : type === 'translations'
              ? '100'
              : null,
        options:
          type === 'nullable_mode'
            ? modes.map((value) => ({
                value,
                label_key: `nodiaAi:proposal.ai_provider_modes.${value}`,
              }))
            : [],
      }),
    );
    this.contractHash = createHash('sha256')
      .update(
        JSON.stringify({
          catalog: this.catalogVersion,
          resource: resourceKey,
          operation,
          fields: this.editableFields,
          template: 1,
          preconditions: 'provider-material-config/1',
          reasoning: 'general-and-selected-model-preference/1',
        }),
      )
      .digest('hex');
  }
  private maxLength(key: string) {
    return key === 'key'
      ? 64
      : key === 'name' || key.endsWith('.thinking_level')
        ? 128
        : 255;
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
      Object.keys(raw).some((k) => !allowed.includes(k)) ||
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
        (k) => !Object.hasOwn(this.editableFields, k),
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
    for (const [key, value] of Object.entries(command)) {
      const type = this.editableFields[key];
      if (value === null && type.startsWith('nullable_')) continue;
      if (type === 'boolean' && typeof value !== 'boolean') return invalid();
      if (type === 'id' && !isId(value)) return invalid();
      if (
        type.includes('string') &&
        (typeof value !== 'string' ||
          !value.trim() ||
          Buffer.byteLength(value) > this.maxLength(key))
      )
        return invalid();
      if (
        type === 'nullable_mode' &&
        !modes.includes(value as (typeof modes)[number])
      )
        return invalid();
      if (type === 'translations') {
        if (!Array.isArray(value) || value.length > 100) return invalid();
        const keys = new Set<string>();
        for (const entry of value) {
          const row = object(entry);
          if (
            Object.keys(row).sort().join(',') !== 'en,es,key' ||
            ['key', 'es', 'en'].some(
              (k) =>
                typeof row[k] !== 'string' ||
                !row[k] ||
                Buffer.byteLength(String(row[k])) > (k === 'key' ? 255 : 5000),
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
    if (
      this.resourceKey === 'ai_provider_catalog' &&
      typeof command.key === 'string'
    )
      command.key = command.key.trim().toLowerCase();
    return { id: raw.id as string | undefined, command, origins };
  }
  private async authority(c: ProposalPreparerContext): Promise<void> {
    if (
      !c.manager.queryRunner?.isTransactionActive ||
      !c.moduleRoutes.includes(route)
    )
      throw new ForbiddenException('nodia_ai:capability_denied');
    if (
      !isCoreAuthorityTransaction(c.manager) &&
      !(await hasAiProviderAuthorityLock(c.manager))
    )
      await lockAuthority(c.manager, false, c.statementTimeoutMs);
    const actor = await currentActor(c.manager, identity(c));
    const [access]: {
      module: boolean;
    }[] = await c.manager.query(
      `SELECT (SELECT count(DISTINCT m.link)=2 FROM modules m JOIN module_groups g ON g.id=m.module_group_id WHERE m.link=ANY($2::text[]) AND m.is_active=true AND g.is_active=true AND ($3::boolean OR EXISTS(SELECT 1 FROM user_modules um WHERE um.user_id=$1 AND um.module_id=m.id AND um.is_active=true))) AS module`,
      [actor.actorId, [route, '/nodia-ai'], actor.isSuperAdmin],
    );
    if (!access?.module)
      throw new ForbiddenException('nodia_ai:capability_denied');
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
    const required =
      this.operation === 'update'
        ? ['id']
        : this.resourceKey === 'ai_providers'
          ? ['catalog_id']
          : ['key', 'name'];
    const missing = required.filter((key) =>
      key === 'id' ? !i.id : !Object.hasOwn(i.command, key),
    );
    if (this.operation === 'update' && !Object.keys(i.command).length)
      missing.push('changes');
    if (missing.length)
      return {
        status: 'needs_clarification',
        partial: this.template(i),
        missingFields: missing,
        clarificationKeys: missing.map(
          (k) => `nodia_ai:ai_provider_${k}_required`,
        ),
      };
    if (
      this.resourceKey === 'ai_providers' &&
      this.operation === 'update' &&
      Array.isArray(i.command.translates)
    ) {
      const existing = await this.store.translations(c.manager, i.id!);
      if (!i.command.translates.length && existing.length)
        throw new BadRequestException(
          'nodia_ai:ai_provider_translation_removal_unsupported',
        );
      const merged = new Map(existing.map((row) => [String(row.key), row]));
      for (const row of i.command.translates)
        merged.set(String(object(row).key), object(row));
      i.command.translates = [...merged.values()].sort((a, b) =>
        String(a.key).localeCompare(String(b.key)),
      );
      this.decode(this.template(i), true);
    }
    const snapshot = await this.snapshot(i, c);
    if (this.operation === 'create') {
      const effective = object(snapshot.effective);
      // Native creation resolves null/omitted default_mode from enabled channels.
      // Freeze that concrete result so the button never approves a displayed null
      // while the writer assigns a channel.
      if (i.command.default_mode === null && effective.default_mode !== null) {
        i.command.default_mode = effective.default_mode;
        i.origins.default_mode = 'contract_default';
      }
      for (const [key, value] of Object.entries(effective))
        if (
          Object.hasOwn(this.editableFields, key) &&
          !Object.hasOwn(i.command, key)
        ) {
          i.command[key] = value;
          i.origins[key] = 'contract_default';
        }
    }
    const frozen = await this.snapshot(i, c),
      target = frozen.target === null ? null : object(frozen.target);
    const changes = Object.entries(i.command).map(([field_key, value]) => ({
      field_key,
      before: target ? review(target[field_key] ?? null) : null,
      before_present: target !== null,
      after: review(value),
      after_present: true,
      origin: i.origins[field_key],
    }));
    for (const field_key of [
      'catalog_details',
      'previous_defaults',
      'affected_connections',
      'configuration_status',
    ])
      if (Object.hasOwn(frozen, field_key))
        changes.push({
          field_key,
          before: null,
          before_present: false,
          after: review(frozen[field_key]),
          after_present: true,
          origin: 'database',
        });
    return {
      status: 'ready',
      commandTemplate: this.template(i),
      scope: {},
      preconditions: frozen,
      publicStep: {
        tool_name: this.toolName,
        kind: 'domain_change',
        target: target
          ? {
              resource_key: this.resourceKey,
              id: String(target.id),
              label: String(target.name ?? target.key ?? target.id),
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
  private async snapshot(
    i: Input,
    c: ProposalPreparerContext,
  ): Promise<NodiaAiJsonObject> {
    const raw = i.id
      ? await this.store.target(c.manager, this.resourceKey, i.id)
      : null;
    if (this.operation === 'update' && !raw)
      throw new NotFoundException('nodia_ai:domain_target_not_found');
    if (this.resourceKey === 'ai_provider_catalog') {
      validateAiProviderCatalogPolicy(
        String(raw?.key ?? i.command.key),
        i.command,
      );
      const collision =
        this.operation === 'create'
          ? await this.store.catalogByKey(c.manager, String(i.command.key))
          : null;
      if (collision)
        throw new ConflictException('nodia_ai:preconditions_changed');
      const effective: NodiaAiJsonObject = {
        can_use_api_key: false,
        can_use_agentic: false,
        ...raw,
        ...i.command,
      };
      return {
        schema_version: 1,
        target: raw,
        effective,
        affected_connections: raw
          ? await this.store.affectedConnections(c.manager, String(raw.id))
          : [],
        configuration_status: {
          availability: 'unknown',
          changes_chat_configuration: false,
        },
      };
    }
    const catalogId = raw?.catalog_id ?? i.command.catalog_id;
    if (!isId(catalogId)) return invalid();
    const catalog = await this.store.target(
      c.manager,
      'ai_provider_catalog',
      catalogId,
    );
    if (!catalog)
      throw new NotFoundException('nodia_ai:domain_target_not_found');
    const native = this.nativeCommand(i, raw);
    const resolved =
      this.operation === 'create'
        ? resolveAiProviderCreate(
            native as CreateAiProviderDto,
            catalog as unknown as AiProviderCatalog,
            await this.store.count(c.manager),
          )
        : resolveAiProviderUpdate(
            native as UpdateAiProviderDto,
            raw as unknown as AiProvider,
            catalog as unknown as AiProviderCatalog,
          );
    const effective: NodiaAiJsonObject = {};
    for (const key of Object.keys(connectionFields))
      if (key !== 'translates')
        effective[key] = Object.hasOwn(resolved, key)
          ? ((resolved as NodiaAiJsonObject)[key] ?? null)
          : (raw?.[key] ?? null);
    if (this.operation === 'create') {
      effective.catalog_id = catalogId;
      effective.translates = i.command.translates ?? [];
    }
    const target: NodiaAiJsonObject | null = raw
      ? { id: raw.id, name: raw.name ?? null }
      : null;
    if (raw && target)
      for (const key of Object.keys(i.command))
        target[key] =
          key === 'translates'
            ? await this.store.translations(c.manager, String(raw.id))
            : viewField(raw, key);
    const defaults =
      effective.is_default === true ? await this.store.defaults(c.manager) : [];
    const modelConfiguration: NodiaAiJsonObject = {};
    const reasoningPreferences: NodiaAiJsonObject[] = [];
    for (const mode of modes)
      if (Object.keys(i.command).some((k) => k.startsWith(`${mode}.`))) {
        const scoped = modeFields(raw, mode);
        const selected = Object.hasOwn(i.command, `${mode}.selected_model`)
          ? i.command[`${mode}.selected_model`]
          : scoped.selected_model;
        const model = typeof selected === 'string' ? selected : null;
        const levels =
          scoped.thinking_levels &&
          typeof scoped.thinking_levels === 'object' &&
          !Array.isArray(scoped.thinking_levels)
            ? scoped.thinking_levels
            : {};
        const currentOverride =
          model && typeof levels[model] === 'string' ? levels[model] : null;
        const general =
          typeof scoped.thinking_level === 'string'
            ? scoped.thinking_level
            : null;
        const preferences = {
          mode,
          model_id: model,
          model_override: Object.hasOwn(i.command, `${mode}.thinking_level`)
            ? i.command[`${mode}.thinking_level`]
            : currentOverride,
          general_level: Object.hasOwn(i.command, `${mode}.thinking_level`)
            ? i.command[`${mode}.thinking_level`]
            : general,
          legacy_boolean:
            typeof scoped.enable_extended_thinking === 'boolean'
              ? scoped.enable_extended_thinking
              : null,
        };
        reasoningPreferences.push(preferences);
        const ids = this.modelIds(scoped);
        const requestedIds = modelFields.flatMap((key) =>
          typeof i.command[`${mode}.${key}`] === 'string'
            ? [String(i.command[`${mode}.${key}`])]
            : [],
        );
        modelConfiguration[mode] = {
          selected_model:
            typeof scoped.selected_model === 'string'
              ? scoped.selected_model
              : null,
          destination_model: model,
          general_level: general,
          model_override: currentOverride,
          model_override_present:
            model !== null && Object.hasOwn(levels, model),
          model_ids: [
            ...new Set(requestedIds.filter((id) => ids.includes(id))),
          ].sort(),
          reasoning: model ? (this.reasoningOptions(scoped)[model] ?? []) : [],
          legacy_boolean: preferences.legacy_boolean,
        };
      }
    const snapshot: NodiaAiJsonObject = {
      schema_version: 1,
      target,
      catalog_details: catalog,
      effective,
      previous_defaults: defaults.filter((row) => row.id !== raw?.id),
      model_configuration: modelConfiguration,
      configuration_status: {
        availability: 'unknown',
        changes_chat_configuration: false,
        reasoning_preferences: reasoningPreferences,
      },
    };
    if (Buffer.byteLength(JSON.stringify(snapshot)) > 65536)
      throw new ConflictException('nodia_ai:result_too_large');
    return snapshot;
  }
  private modelIds(scoped: NodiaAiJsonObject): string[] {
    if (!Array.isArray(scoped.available_models)) return [];
    if (scoped.available_models.length > 1000)
      throw new ConflictException('nodia_ai:result_too_large');
    return [
      ...new Set(
        scoped.available_models.flatMap((row) =>
          row &&
          typeof row === 'object' &&
          !Array.isArray(row) &&
          typeof row.id === 'string' &&
          row.id.length <= 255
            ? [row.id]
            : [],
        ),
      ),
    ].sort();
  }
  private reasoningOptions(scoped: NodiaAiJsonObject): NodiaAiJsonObject {
    const result: NodiaAiJsonObject = Object.create(null) as NodiaAiJsonObject;
    if (!Array.isArray(scoped.available_models)) return result;
    for (const row of scoped.available_models) {
      if (
        !row ||
        typeof row !== 'object' ||
        Array.isArray(row) ||
        typeof row.id !== 'string'
      )
        continue;
      const options = row.supportedReasoningEfforts;
      if (Array.isArray(options))
        result[row.id] = options
          .filter((v): v is string => typeof v === 'string' && v.length <= 128)
          .slice(0, 32);
    }
    return result;
  }
  private nativeCommand(
    i: Input,
    target: NodiaAiJsonObject | null,
  ): NodiaAiJsonObject {
    const native: NodiaAiJsonObject = Object.fromEntries(
      Object.entries(i.command).filter(([key]) => !key.includes('.')),
    );
    const fields: NodiaAiJsonObject = {};
    for (const mode of modes) {
      const entries = Object.entries(i.command).filter(([key]) =>
        key.startsWith(`${mode}.`),
      );
      if (!entries.length) continue;
      const old = modeFields(target, mode),
        next: NodiaAiJsonObject = {};
      for (const [path, value] of entries) {
        const key = path.slice(mode.length + 1);
        if (modelFields.includes(key as (typeof modelFields)[number])) {
          if (
            value !== null &&
            !this.modelIds(old).includes(String(value)) &&
            value !== old[key]
          )
            throw new BadRequestException(
              'nodia_ai:ai_provider_model_unavailable',
            );
          next[key] = value;
        }
      }
      if (Object.hasOwn(i.command, `${mode}.thinking_level`)) {
        const model = Object.hasOwn(next, 'selected_model')
          ? next.selected_model
          : old.selected_model;
        const value = i.command[`${mode}.thinking_level`],
          levels =
            old.thinking_levels &&
            typeof old.thinking_levels === 'object' &&
            !Array.isArray(old.thinking_levels)
              ? old.thinking_levels
              : {};
        const available =
          typeof model === 'string' ? this.reasoningOptions(old)[model] : [];
        if (
          value !== null &&
          !['low', 'medium', 'high'].includes(String(value)) &&
          !(typeof model === 'string' && value === levels[model]) &&
          value !== old.thinking_level &&
          (!Array.isArray(available) || !available.includes(value))
        )
          throw new BadRequestException(
            'nodia_ai:ai_provider_reasoning_unavailable',
          );
        next.thinking_level = value;
        if (typeof model === 'string' && model)
          next.thinking_levels = { [model]: value };
      }
      fields[mode] = next;
    }
    if (Object.keys(fields).length) native.fields = fields;
    return native;
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
      this.operation === 'update' &&
      edits.some((edit) => edit.field_key === 'translates') &&
      Array.isArray(next.command.translates)
    ) {
      const keys = new Set(
        next.command.translates.map((row) => String(object(row).key)),
      );
      const persisted = await this.store.translations(c.manager, next.id!);
      if (persisted.some((row) => !keys.has(String(row.key))))
        throw new BadRequestException(
          'nodia_ai:ai_provider_translation_removal_unsupported',
        );
    }
    return this.template(next);
  }
  async verifyAuthority(
    step: StoredProposalStep,
    c: ProposalPreparerContext,
  ): Promise<void> {
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
  ): Promise<void> {
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
  ): Promise<{
    id: string;
  }> {
    await this.verifyAuthority(step, c);
    await c.manager.query(
      'LOCK TABLE ai_provider_catalog, ai_providers IN SHARE ROW EXCLUSIVE MODE',
    );
    await this.verifyPreconditions(step, c);
    const i = this.decode(step.commandTemplate, true),
      raw = i.id
        ? await this.store.target(c.manager, this.resourceKey, i.id)
        : null;
    const result = await this.writer(
      i,
      c,
      this.resourceKey === 'ai_providers'
        ? this.nativeCommand(i, raw)
        : i.command,
    );
    if (!isId(result.id) || (i.id && result.id !== i.id))
      throw new InternalServerErrorException('nodia_ai:invalid_effect_result');
    return { id: result.id };
  }
}
@Injectable()
export class BuildNodiaAiProviderOperationsUseCase {
  readonly operations: readonly NodiaAiProviderOperation[];
  constructor(
    store: NodiaAiProviderOperationsService,
    create: CreateAiProviderUseCase,
    update: UpdateAiProviderUseCase,
    createCatalog: CreateAiProviderCatalogUseCase,
    updateCatalog: UpdateAiProviderCatalogUseCase,
  ) {
    this.operations = Object.freeze(
      (['ai_providers', 'ai_provider_catalog'] as Resource[]).flatMap(
        (resource) =>
          (['create', 'update'] as const).map(
            (operation) =>
              new ProviderOperation(
                resource,
                operation,
                store,
                async (i, c, command) => {
                  const actor = identity(c);
                  if (resource === 'ai_providers')
                    return operation === 'create'
                      ? create.execute(command as CreateAiProviderDto, actor)
                      : update.execute(
                          i.id!,
                          command as UpdateAiProviderDto,
                          actor,
                        );
                  return operation === 'create'
                    ? createCatalog.execute(
                        command as unknown as CreateAiProviderCatalogDto,
                        actor,
                      )
                    : updateCatalog.execute(
                        i.id!,
                        command as UpdateAiProviderCatalogDto,
                        actor,
                      );
                },
              ),
          ),
      ),
    );
  }
}
