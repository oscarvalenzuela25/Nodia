import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
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
import {
  nodiaAiSecureOperationIdentity,
  type NodiaAiSecureOperation,
} from '../../nodia-ai-proposal/types/secure-operation.types.js';
import { NodiaAiSecurePreparationService } from '../nodia-ai-secure-preparation.service.js';
import type { NodiaAiProposalReviewField } from '../../nodia-ai-proposal/types/proposal-review.types.js';
const route = '/ai-providers';
const names = [
  'nodia_secure_flows_prepare_api_key_create',
  'nodia_secure_flows_prepare_api_key_update',
  'nodia_secure_flows_prepare_connection_login',
  'nodia_secure_flows_prepare_nodia_logout',
  'nodia_api_keys_prepare_delete',
  'nodia_ai_providers_prepare_codex_logout',
  'nodia_ai_providers_prepare_sync_models',
] as const;
const isId = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[1-9][0-9]{0,18}$/.test(v) &&
  BigInt(v) <= 9223372036854775807n;
const invalid = (): never => {
  throw new BadRequestException('nodia_ai:invalid_input');
};
function object(v: unknown): NodiaAiJsonObject {
  if (
    !v ||
    typeof v !== 'object' ||
    Array.isArray(v) ||
    Object.getPrototypeOf(v) !== Object.prototype
  )
    return invalid();
  return v as NodiaAiJsonObject;
}
function review(value: NodiaAiJsonValue): NodiaAiJsonValue {
  if (Array.isArray(value)) return { kind: 'array', items: value.map(review) };
  if (value !== null && typeof value === 'object')
    return {
      kind: 'object',
      fields: Object.entries(value).map(([field_key, v]) => ({
        field_key,
        value: review(v),
      })),
    };
  return value;
}
class SecureOperation implements NodiaAiSecureOperation {
  readonly catalogVersion = 'nodia-ai-ai29-secure/1';
  readonly contractHash: string;
  readonly kind;
  readonly moduleRoutes: readonly string[];
  readonly actionKeys: readonly string[];
  readonly bindableFields = {};
  readonly outputKeys = {};
  readonly editableFields: Readonly<Record<string, string>>;
  readonly reviewFields: readonly NodiaAiProposalReviewField[];
  constructor(
    readonly toolName: string,
    private readonly store: NodiaAiSecurePreparationService,
  ) {
    const definition =
      nodiaAiSecureOperationIdentity(toolName) ??
      (toolName === 'nodia_ai_providers_prepare_gemini_web_logout'
        ? {
            kind: 'gemini_web_logout' as const,
            providerRequired: true,
            keyRequired: false,
            modeRequired: false,
          }
        : null);
    if (!definition) throw new Error('nodia_ai:invalid_historical_reader');
    this.kind = definition.kind;
    this.moduleRoutes = definition.providerRequired ? [route] : [];
    // Legacy publication metadata; role actions do not gate module-based access.
    this.actionKeys = definition.providerRequired ? ['ai:manage'] : [];
    this.editableFields =
      this.kind === 'api_key_create' || this.kind === 'api_key_update'
        ? {
            label: 'string',
            sort_order: 'integer',
            is_selected: 'boolean',
            is_active: 'boolean',
          }
        : {};
    this.reviewFields = Object.entries(this.editableFields).map(
      ([field_key, type]) => ({
        field_key,
        label_key: `nodiaAi:proposal.ai_provider_fields.${field_key}`,
        kind:
          type === 'string'
            ? 'text'
            : type === 'integer'
              ? 'integer'
              : 'boolean',
        nullable: false,
        max_length: type === 'string' ? 100 : null,
        minimum: type === 'integer' ? '0' : null,
        maximum: type === 'integer' ? '1000000' : null,
        options: [],
      }),
    );
    this.contractHash = createHash('sha256')
      .update(
        JSON.stringify({
          version: this.catalogVersion,
          kind: this.kind,
          fields: this.editableFields,
          template: 1,
          preconditions: 'safe-key-pool/1',
          receipt: 'opaque-flow/1',
        }),
      )
      .digest('hex');
  }
  private decode(raw: NodiaAiJsonObject, stored = false): NodiaAiJsonObject {
    if (this.kind === 'gemini_web_logout')
      throw new BadRequestException('nodia_ai:mode_retired');
    object(raw);
    const definition = nodiaAiSecureOperationIdentity(this.toolName)!;
    const fields = [
      ...(definition.providerRequired ? ['provider_id'] : []),
      ...(definition.keyRequired ? ['key_id'] : []),
      ...(definition.modeRequired ? ['mode'] : []),
    ];
    if (
      Object.keys(raw).some(
        (k) =>
          ![
            ...fields,
            ...(stored
              ? ['schema_version', 'command', 'origins']
              : Object.keys(this.editableFields)),
          ].includes(k),
      ) ||
      (stored && raw.schema_version !== 1)
    )
      return invalid();
    const command = stored
      ? { ...object(raw.command) }
      : Object.fromEntries(
          Object.entries(raw).filter(([k]) =>
            Object.hasOwn(this.editableFields, k),
          ),
        );
    if (
      Object.keys(command).some((k) => !Object.hasOwn(this.editableFields, k))
    )
      return invalid();
    for (const [k, v] of Object.entries(command)) {
      if (
        k === 'label' &&
        (typeof v !== 'string' || !v.trim() || v.length > 100)
      )
        return invalid();
      if (
        k === 'sort_order' &&
        (typeof v !== 'number' ||
          !Number.isSafeInteger(v) ||
          v < 0 ||
          v > 1000000)
      )
        return invalid();
      if (['is_selected', 'is_active'].includes(k) && typeof v !== 'boolean')
        return invalid();
    }
    for (const k of ['provider_id', 'key_id'])
      if (raw[k] !== undefined && !isId(raw[k])) return invalid();
    if (
      raw.mode !== undefined &&
      !['api_key', 'agentic'].includes(String(raw.mode))
    )
      return invalid();
    const origins = stored
      ? { ...object(raw.origins) }
      : Object.fromEntries(Object.keys(command).map((k) => [k, 'user']));
    if (
      Object.keys(origins).sort().join(',') !==
        Object.keys(command).sort().join(',') ||
      Object.values(origins).some(
        (v) => !['user', 'contract_default'].includes(String(v)),
      )
    )
      return invalid();
    return {
      schema_version: 1,
      ...Object.fromEntries(
        fields.filter((k) => raw[k] !== undefined).map((k) => [k, raw[k]]),
      ),
      command,
      origins,
    };
  }
  private async authority(c: ProposalPreparerContext): Promise<void> {
    if (!c.manager.queryRunner?.isTransactionActive)
      throw new ForbiddenException('authorization:transaction_required');
    if (
      !isCoreAuthorityTransaction(c.manager) &&
      !(await hasAiProviderAuthorityLock(c.manager))
    )
      await lockAuthority(c.manager, false, c.statementTimeoutMs);
    const actor = await currentActor(c.manager, {
      userId: c.actor.actorId,
      sessionId: c.actor.sessionId,
    });
    const routes = ['/nodia-ai', ...this.moduleRoutes];
    if (this.moduleRoutes.some((r) => !c.moduleRoutes.includes(r)))
      throw new ForbiddenException('nodia_ai:capability_denied');
    const [access]: {
      module: boolean;
    }[] = await c.manager.query(
      `SELECT (SELECT count(DISTINCT m.link)=$4 FROM modules m JOIN module_groups g ON g.id=m.module_group_id WHERE m.link=ANY($2::text[]) AND m.is_active=true AND g.is_active=true AND ($3::boolean OR EXISTS(SELECT 1 FROM user_modules um WHERE um.user_id=$1 AND um.module_id=m.id AND um.is_active=true))) AS module`,
      [actor.actorId, routes, actor.isSuperAdmin, routes.length],
    );
    if (!access?.module)
      throw new ForbiddenException('nodia_ai:capability_denied');
  }
  async prepare(
    raw: NodiaAiJsonObject,
    c: ProposalPreparerContext,
    previous?: NodiaAiJsonObject,
  ): Promise<ProposalPreparation> {
    const template = this.decode(raw);
    if (previous) {
      const old = this.decode(previous, true);
      for (const k of ['provider_id', 'key_id', 'mode']) {
        if (
          template[k] !== undefined &&
          old[k] !== undefined &&
          template[k] !== old[k]
        )
          return invalid();
        if (template[k] === undefined && old[k] !== undefined)
          template[k] = old[k];
      }
      template.command = {
        ...object(old.command),
        ...object(template.command),
      };
      template.origins = {
        ...object(old.origins),
        ...object(template.origins),
      };
    }
    return this.prepareInput(template, c);
  }
  reprepareStored(template: NodiaAiJsonObject, c: ProposalPreparerContext) {
    return this.prepareInput(this.decode(template, true), c);
  }
  private async prepareInput(
    template: NodiaAiJsonObject,
    c: ProposalPreparerContext,
  ): Promise<ProposalPreparation> {
    await this.authority(c);
    const def = nodiaAiSecureOperationIdentity(this.toolName)!;
    const required = [
      ...(def.providerRequired ? ['provider_id'] : []),
      ...(def.keyRequired ? ['key_id'] : []),
      ...(def.modeRequired ? ['mode'] : []),
    ];
    const missing = required.filter((k) => template[k] === undefined);
    const command = object(template.command),
      origins = object(template.origins);
    if (this.kind === 'api_key_create' && command.label === undefined)
      missing.push('label');
    if (missing.length)
      return {
        status: 'needs_clarification',
        partial: template,
        missingFields: missing,
        clarificationKeys: missing.map((k) => `nodia_ai:secure_${k}_required`),
      };
    const snapshot = await this.snapshot(template, c);
    if (this.kind === 'api_key_create') {
      for (const [k, v] of Object.entries({
        sort_order: 0,
        is_active: true,
        is_selected: false,
      }))
        if (command[k] === undefined) {
          command[k] = v;
          origins[k] = 'contract_default';
        }
    }
    if (this.kind === 'api_key_create' || this.kind === 'api_key_update') {
      const pool = snapshot.key_pool as NodiaAiJsonObject[];
      const target = pool.find((k) => k.id === template.key_id);
      const active = command.is_active ?? target?.is_active ?? true;
      if (command.is_selected === true && active !== true) return invalid();
      const others = pool.filter(
        (k) => k.is_active === true && k.id !== template.key_id,
      ).length;
      const normalized =
        active === false ? false : others === 0 ? true : command.is_selected;
      if (normalized !== undefined && normalized !== command.is_selected) {
        command.is_selected = normalized;
        origins.is_selected = 'contract_default';
      }
    }
    // Selection normalization and the approved pool must come from the same
    // observation. A second READ COMMITTED read could freeze a different pool.
    const frozen = snapshot;
    const target = frozen.target as NodiaAiJsonObject | null;
    const changes = Object.entries(command).map(([field_key, after]) => ({
      field_key,
      before: target?.[field_key] ?? null,
      before_present: target !== null,
      after,
      after_present: true,
      origin: origins[field_key],
    }));
    // Login/logout/synchronization are effects too. Show the approved operation and shared connection explicitly.
    changes.push({
      field_key: 'secure_operation',
      before: null,
      before_present: false,
      after: this.kind,
      after_present: true,
      origin: 'contract_default',
    });
    if (frozen.provider !== null)
      changes.push({
        field_key: 'connection',
        before: null,
        before_present: false,
        after: review(frozen.provider),
        after_present: true,
        origin: 'database',
      });
    if (Array.isArray(frozen.key_pool)) {
      const pool = frozen.key_pool as NodiaAiJsonObject[];
      const projected = pool
        .filter(
          (k) => !(this.kind === 'api_key_delete' && k.id === template.key_id),
        )
        .map((k) => ({
          id: k.id,
          label:
            k.id === template.key_id ? (command.label ?? k.label) : k.label,
          is_active:
            k.id === template.key_id
              ? (command.is_active ?? k.is_active)
              : k.is_active,
          is_selected:
            k.id === template.key_id
              ? (command.is_selected ?? k.is_selected)
              : command.is_selected === true
                ? false
                : k.is_selected,
        }));
      const active = projected.filter((k) => k.is_active === true);
      if (
        active.length +
          (this.kind === 'api_key_create' && command.is_active === true
            ? 1
            : 0) ===
          1 &&
        active.length === 1
      )
        active[0].is_selected = true;
      changes.push({
        field_key: 'key_selection_impact',
        before: review(
          pool.map(({ id, label, is_selected, is_active }) => ({
            id,
            label,
            is_selected,
            is_active,
          })),
        ),
        before_present: true,
        after: review(projected),
        after_present: true,
        origin: 'database',
      });
    }
    if (template.mode)
      changes.push({
        field_key: 'mode',
        before: null,
        before_present: false,
        after: template.mode,
        after_present: true,
        origin: 'user',
      });
    return {
      status: 'ready',
      commandTemplate: template,
      scope: {},
      preconditions: frozen,
      publicStep: {
        tool_name: this.toolName,
        kind: 'secure_flow',
        target: target
          ? {
              resource_key: 'ai_api_keys',
              id: String(target.id),
              label: String(target.label),
            }
          : frozen.provider
            ? {
                resource_key: 'ai_providers',
                id: String(template.provider_id),
                label: String(object(frozen.provider).name),
              }
            : null,
        scope: {},
        changes,
        depends_on: [],
        effect_key: `secure_flows.${this.kind}`,
        output_bindings: [],
      },
    };
  }
  private async snapshot(
    t: NodiaAiJsonObject,
    c: ProposalPreparerContext,
  ): Promise<NodiaAiJsonObject> {
    if (this.kind === 'gemini_web_logout') return invalid();
    if (this.kind === 'nodia_logout')
      return {
        schema_version: 1,
        provider: null,
        provider_key: null,
        target: null,
      };
    const provider = await this.store.provider(
      c.manager,
      String(t.provider_id),
    );
    const key = provider.provider_key;
    const mode =
      this.kind === 'codex_logout' ? 'agentic' : String(t.mode ?? 'api_key');
    if (
      (this.kind === 'connection_login' &&
        (mode === 'api_key' || !['gemini', 'openai'].includes(String(key)))) ||
      (this.kind === 'codex_logout' && key !== 'openai')
    )
      return invalid();
    if (this.kind === 'api_key_create' && provider.can_use_api_key !== true)
      throw new ConflictException('nodia_ai:capability_unavailable');
    if (['connection_login', 'sync_models'].includes(this.kind)) {
      const suffix = mode === 'api_key' ? 'api_key' : mode;
      if (
        provider.is_active !== true ||
        provider.catalog_active !== true ||
        provider[`can_use_${suffix}`] !== true ||
        provider[`use_${suffix}`] !== true
      )
        throw new ConflictException('nodia_ai:capability_unavailable');
    }
    const snapshot: NodiaAiJsonObject = {
      schema_version: 1,
      provider,
      provider_key: key,
      target: null,
    };
    if (this.kind.startsWith('api_key_')) {
      const pool = await this.store.keys(c.manager, String(t.provider_id));
      const target = pool.find((k) => k.id === t.key_id) ?? null;
      if (this.kind !== 'api_key_create' && !target)
        throw new NotFoundException('nodia_ai:domain_target_not_found');
      snapshot.key_pool = pool;
      snapshot.target = target;
    }
    return snapshot;
  }
  async applyEdits(
    template: NodiaAiJsonObject,
    edits: readonly ProposalFieldEdit[],
    c: ProposalPreparerContext,
  ): Promise<NodiaAiJsonObject> {
    await this.authority(c);
    const next = this.decode(template, true),
      command = object(next.command),
      origins = object(next.origins),
      seen = new Set<string>();
    for (const edit of edits) {
      if (
        !Object.hasOwn(this.editableFields, edit.field_key) ||
        seen.has(edit.field_key)
      )
        return invalid();
      seen.add(edit.field_key);
      command[edit.field_key] = edit.value;
      origins[edit.field_key] = 'user';
    }
    return this.decode(next, true);
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
  async verifyHistoricalReadAuthority(
    step: StoredProposalStep,
    c: ProposalPreparerContext,
  ) {
    if (
      step.toolName !== this.toolName ||
      !/^[a-f0-9]{64}$/.test(step.contractHash) ||
      !isDeepStrictEqual(step.scope, {})
    )
      throw new ForbiddenException('nodia_ai:capability_denied');
    const template = object(step.commandTemplate);
    if (
      template.schema_version !== 1 ||
      !object(template.command) ||
      !object(template.origins)
    )
      return invalid();
    const providerRequired = this.kind !== 'nodia_logout';
    if (providerRequired && !isId(template.provider_id)) return invalid();
    if (
      ['api_key_update', 'api_key_delete'].includes(this.kind) &&
      !isId(template.key_id)
    )
      return invalid();
    if (
      ['connection_login', 'sync_models'].includes(this.kind) &&
      !['agentic', 'api_key', 'token_plan_agentic', 'token_plan_web'].includes(
        String(template.mode),
      )
    )
      return invalid();
    await this.authority(c);
  }
  async verifyPreconditions(
    step: StoredProposalStep,
    c: ProposalPreparerContext,
  ) {
    await this.verifyAuthority(step, c);
    if (
      !isDeepStrictEqual(
        await this.snapshot(this.decode(step.commandTemplate, true), c),
        step.preconditions,
      )
    )
      throw new ConflictException('nodia_ai:preconditions_changed');
  }
}
@Injectable()
export class BuildNodiaAiSecureOperationsUseCase {
  readonly operations: readonly NodiaAiSecureOperation[];
  readonly historicalReaders: readonly NodiaAiSecureOperation[];
  constructor(store: NodiaAiSecurePreparationService) {
    this.historicalReaders = Object.freeze([
      new SecureOperation(
        'nodia_ai_providers_prepare_gemini_web_logout',
        store,
      ),
    ]);
    this.operations = Object.freeze(
      names.map((name) => new SecureOperation(name, store)),
    );
  }
}
