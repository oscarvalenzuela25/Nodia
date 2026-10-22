import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { isUUID } from 'class-validator';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { NodiaAiAuthorizedActor } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  ProposalFieldEdit,
  ProposalPreparation,
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import { NodiaAiPreferenceService } from '../nodia-ai-preference.service.js';
import { NodiaAiPreference } from '../entities/nodia-ai-preference.entity.js';
import {
  NODIA_AI_DELETION_JOURNAL,
  NODIA_AI_DELETION_PROOF,
  type NodiaAiDeletionJournalPort,
} from '../../nodia-ai-recovery/types/deletion-journal.js';
import {
  NODIA_AI_PREFERENCE_LIMIT,
  preferenceDefinition,
  preferenceInvalid,
  preferenceScopeHash,
  validatePreferenceValue,
  type NodiaAiPreferenceOperation,
} from '../types/preference.types.js';

class PreferenceOperation implements NodiaAiPreferenceOperation {
  readonly resourceKey = 'nodia_ai_preferences' as const;
  readonly catalogVersion = 'nodia-ai-ai33-preferences/1';
  readonly moduleRoutes: readonly string[] = [];
  readonly actionKeys: readonly string[] = [];
  readonly bindableFields = {};
  readonly outputKeys = {};
  readonly toolName: string;
  readonly contractHash: string;
  readonly editableFields: Readonly<Record<string, string>>;
  readonly reviewFields;
  constructor(
    readonly operation: 'create' | 'update' | 'delete',
    private readonly store: NodiaAiPreferenceService,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    private readonly deletionJournal: NodiaAiDeletionJournalPort,
  ) {
    this.toolName = `nodia_preferences_prepare_${operation}`;
    this.editableFields = operation === 'delete' ? {} : { value: 'string' };
    this.reviewFields =
      operation === 'delete'
        ? []
        : [
            {
              field_key: 'value',
              label_key: 'nodiaAi:proposal.preference_fields.value',
              kind: 'text' as const,
              nullable: false,
              max_length: 36,
              minimum: null,
              maximum: null,
              options: [],
            },
          ];
    this.contractHash = createHash('sha256')
      .update(
        JSON.stringify({
          catalog: this.catalogVersion,
          operation,
          owner: 'actor-only',
          limit: NODIA_AI_PREFERENCE_LIMIT,
          scope: 'supplier-business-required',
          keys: [
            'expense_category_id',
            'income_category_id',
            'business_id',
            'supplier_id',
            'property_id',
          ],
          CAS: true,
        }),
      )
      .digest('hex');
  }
  private decode(raw: NodiaAiJsonObject, stored = false): NodiaAiJsonObject {
    const allowed = stored
      ? [
          'schema_version',
          'id',
          'expected_revision',
          'scope_key',
          'scope',
          'key',
          'value',
        ]
      : this.operation === 'create'
        ? ['scope_key', 'scope', 'key', 'value']
        : this.operation === 'update'
          ? ['id', 'expected_revision', 'value']
          : ['id', 'expected_revision'];
    if (
      Object.keys(raw).some((key) => !allowed.includes(key)) ||
      (stored && raw.schema_version !== 1) ||
      (raw.id !== undefined && !isUUID(raw.id, '4')) ||
      (raw.expected_revision !== undefined &&
        (!Number.isInteger(raw.expected_revision) ||
          Number(raw.expected_revision) < 1 ||
          Number(raw.expected_revision) > 2147483646))
    )
      return preferenceInvalid();
    return {
      ...raw,
      ...(raw.scope &&
      typeof raw.scope === 'object' &&
      !Array.isArray(raw.scope)
        ? { scope: { ...raw.scope } }
        : {}),
    };
  }
  private async authority(
    c: ProposalPreparerContext,
    route?: string,
  ): Promise<NodiaAiAuthorizedActor> {
    if (!c.manager.queryRunner?.isTransactionActive)
      throw new ForbiddenException('nodia_ai:capability_denied');
    await lockAuthority(c.manager, false, c.statementTimeoutMs);
    const actor = await this.authorize.execute(
      { userId: c.actor.actorId, sessionId: c.actor.sessionId },
      { moduleRoutes: route ? [route] : [] },
      c.manager,
    );
    const [chat]: { owner_id: string }[] = await c.manager.query(
      "SELECT owner_id FROM nodia_ai_conversations WHERE id=$1 AND lifecycle='active' AND expires_at>clock_timestamp()",
      [c.conversationId],
    );
    if (!chat || chat.owner_id !== actor.actorId)
      throw new ForbiddenException('nodia_ai:author_required');
    return actor;
  }
  async prepare(
    raw: NodiaAiJsonObject,
    c: ProposalPreparerContext,
    previous?: NodiaAiJsonObject,
  ): Promise<ProposalPreparation> {
    const i = this.decode(raw),
      old = previous ? this.decode(previous, true) : null;
    if (old) {
      if (i.id && old.id && i.id !== old.id) return preferenceInvalid();
      Object.assign(i, { ...old, ...i });
    }
    return this.prepareInput(i, c);
  }
  reprepareStored(template: NodiaAiJsonObject, c: ProposalPreparerContext) {
    return this.prepareInput(this.decode(template, true), c);
  }
  private async prepareInput(
    i: NodiaAiJsonObject,
    c: ProposalPreparerContext,
  ): Promise<ProposalPreparation> {
    const actor = await this.authority(c);
    const required =
      this.operation === 'create'
        ? ['scope_key', 'scope', 'key', 'value']
        : this.operation === 'update'
          ? ['id', 'expected_revision', 'value']
          : ['id', 'expected_revision'];
    const missing = required.filter((key) => !Object.hasOwn(i, key));
    if (missing.length)
      return {
        status: 'needs_clarification',
        partial: { ...i, schema_version: 1 },
        missingFields: missing,
        clarificationKeys: missing.map(
          (key) => `nodia_ai:preference_${key}_required`,
        ),
      };
    const target =
      this.operation === 'create'
        ? null
        : await this.store.target(c.manager, actor.actorId, String(i.id));
    if (this.operation !== 'create' && !target)
      throw new NotFoundException('nodia_ai:preference_not_found');
    if (target) {
      if (target.revision !== i.expected_revision)
        throw new ConflictException('nodia_ai:revision_conflict');
      i = {
        ...i,
        scope_key: target.scope_key,
        scope: target.scope,
        key: target.key,
        ...(this.operation === 'delete' ? { value: target.value } : {}),
      };
    }
    const value = validatePreferenceValue(i);
    Object.assign(i, value);
    if (this.operation !== 'delete')
      await this.authority(
        c,
        preferenceDefinition(value.scope_key, value.key).route,
      );
    const template = { ...i, schema_version: 1, id: i.id ?? randomUUID() };
    const preconditions = await this.snapshot(template, c, actor);
    const before = target
      ? {
          scope_key: target.scope_key,
          key: target.key,
          business_id: target.scope.business_id ?? null,
          value: target.value,
        }
      : null;
    const after = {
      scope_key: value.scope_key,
      key: value.key,
      business_id: value.scope.business_id ?? null,
      value: value.value,
    };
    const changes = Object.entries(after).map(([field_key, afterValue]) => ({
      field_key,
      before: before?.[field_key as keyof typeof before] ?? null,
      before_present: before !== null,
      after: this.operation === 'delete' ? null : afterValue,
      after_present: this.operation !== 'delete',
      origin: 'user',
    }));
    const reference = preconditions.reference;
    if (reference && typeof reference === 'object' && !Array.isArray(reference))
      for (const field_key of ['value_label', 'scope_label'])
        changes.push({
          field_key,
          before: reference[`previous_${field_key}`] ?? null,
          before_present: target !== null,
          after: reference[field_key] ?? null,
          after_present: true,
          origin: 'database',
        });
    const scope = { subject_user_id: actor.actorId, ...value.scope };
    return {
      status: 'ready',
      commandTemplate: template,
      scope,
      preconditions,
      publicStep: {
        tool_name: this.toolName,
        kind: 'preference_change',
        target: target
          ? {
              resource_key: this.resourceKey,
              id: target.id,
              label: `${target.scope_key}.${target.key}`,
            }
          : null,
        scope,
        changes,
        depends_on: [],
        effect_key: `preferences.${this.operation}`,
        output_bindings: [],
      },
    };
  }
  private async snapshot(
    i: NodiaAiJsonObject,
    c: ProposalPreparerContext,
    actor: NodiaAiAuthorizedActor,
  ): Promise<NodiaAiJsonObject> {
    const value = validatePreferenceValue(i),
      target =
        this.operation === 'create'
          ? null
          : await this.store.target(c.manager, actor.actorId, String(i.id));
    if (
      this.operation !== 'create' &&
      (!target || target.revision !== i.expected_revision)
    )
      throw new ConflictException('nodia_ai:preconditions_changed');
    if (
      target &&
      (target.scope_key !== i.scope_key ||
        target.key !== i.key ||
        !isDeepStrictEqual(target.scope, i.scope))
    )
      throw new ConflictException('nodia_ai:preconditions_changed');
    const all = await this.store.list(c.manager, actor.actorId);
    if (
      this.operation === 'create' &&
      all.some(
        (row) =>
          row.scope_hash ===
            preferenceScopeHash(value.scope_key, value.scope) &&
          row.key === value.key,
      )
    )
      throw new ConflictException('nodia_ai:preference_exists');
    if (this.operation === 'create' && all.length >= NODIA_AI_PREFERENCE_LIMIT)
      throw new ConflictException('nodia_ai:preference_limit');
    let reference: NodiaAiJsonObject | null = null;
    if (this.operation !== 'delete') {
      const [ref] = await this.store.references(
        c.manager,
        actor,
        actor.modules.map((module) => module.route),
        [{ ...value, id: String(i.id) }],
      );
      if (!ref?.value_label)
        throw new NotFoundException(
          'nodia_ai:preference_reference_unavailable',
        );
      const old = target
        ? (
            await this.store.references(
              c.manager,
              actor,
              actor.modules.map((module) => module.route),
              [target],
            )
          )[0]
        : null;
      reference = {
        value_label: ref.value_label,
        scope_label: ref.scope_label,
        previous_value_label: old?.value_label ?? null,
        previous_scope_label: old?.scope_label ?? null,
      };
    }
    return {
      schema_version: 1,
      target: target
        ? { id: target.id, revision: target.revision, value: target.value }
        : null,
      reference,
    };
  }
  async applyEdits(
    template: NodiaAiJsonObject,
    edits: readonly ProposalFieldEdit[],
    c: ProposalPreparerContext,
  ): Promise<NodiaAiJsonObject> {
    const i = this.decode(template, true);
    if (
      edits.length !== 1 ||
      edits[0].field_key !== 'value' ||
      this.operation === 'delete'
    )
      return preferenceInvalid();
    i.value = edits[0].value;
    validatePreferenceValue(i);
    await this.authority(c, preferenceDefinition(i.scope_key, i.key).route);
    return i;
  }
  async verifyAuthority(
    step: StoredProposalStep,
    c: ProposalPreparerContext,
  ): Promise<void> {
    const i = this.decode(step.commandTemplate, true);
    validatePreferenceValue(i);
    if (
      step.toolName !== this.toolName ||
      step.contractHash !== this.contractHash ||
      !isDeepStrictEqual(step.scope, {
        subject_user_id: c.actor.actorId,
        ...validatePreferenceValue(i).scope,
      })
    )
      throw new ForbiddenException('nodia_ai:capability_denied');
    await this.authority(
      c,
      this.operation === 'delete'
        ? undefined
        : preferenceDefinition(i.scope_key, i.key).route,
    );
  }
  async verifyPreconditions(
    step: StoredProposalStep,
    c: ProposalPreparerContext,
  ): Promise<void> {
    await this.verifyAuthority(step, c);
    const actor = await this.authority(c);
    const actual = await this.snapshot(
      this.decode(step.commandTemplate, true),
      c,
      actor,
    );
    if (!isDeepStrictEqual(actual, step.preconditions))
      throw new ConflictException('nodia_ai:preconditions_changed');
  }
  async executeConfirmed(
    step: StoredProposalStep,
    c: ProposalPreparerContext,
  ): Promise<{ id: string; ownerId: string; revision: number }> {
    await this.verifyAuthority(step, c);
    await this.store.lockOwner(c.manager, c.actor.actorId);
    const i = this.decode(step.commandTemplate, true),
      value = validatePreferenceValue(i);
    if (this.operation !== 'delete')
      await this.store.lockReference(c.manager, value);
    await this.verifyPreconditions(step, c);
    if (!isUUID(c.executionStepId, '4'))
      throw new ForbiddenException('nodia_ai:confirmation_required');
    const [execution]: { id: string }[] = await c.manager.query(
      `SELECT s.id FROM nodia_ai_execution_steps s JOIN nodia_ai_executions e ON e.id=s.execution_id WHERE s.id=$1 AND s.source_step_id=$2 AND e.actor_id=$3 AND e.conversation_id=$4`,
      [c.executionStepId, step.id, c.actor.actorId, c.conversationId],
    );
    if (!execution)
      throw new ForbiddenException('nodia_ai:confirmation_required');
    if (this.operation === 'delete' && this.deletionJournal.enabled) {
      const proof = c[NODIA_AI_DELETION_PROOF];
      if (!proof || proof.executionStepId !== c.executionStepId || proof.preferenceId !== String(i.id))
        throw new ForbiddenException('nodia_ai:deletion_journal_required');
    }
    const revision =
      this.operation === 'create' ? 1 : Number(i.expected_revision) + 1;
    if (this.operation === 'delete')
      await c.manager
        .getRepository(NodiaAiPreference)
        .delete({
          id: String(i.id),
          owner_id: c.actor.actorId,
          revision: Number(i.expected_revision),
        });
    else
      await c.manager
        .getRepository(NodiaAiPreference)
        .save(
          Object.assign(new NodiaAiPreference(), {
            id: i.id,
            owner_id: c.actor.actorId,
            ...value,
            scope_hash: preferenceScopeHash(value.scope_key, value.scope),
            revision,
            source_conversation_id: c.conversationId,
            accepted_step_id: c.executionStepId,
            updated_at: new Date(),
          }),
        );
    return { id: String(i.id), ownerId: c.actor.actorId, revision };
  }
}
@Injectable()
export class BuildNodiaAiPreferenceOperationsUseCase {
  readonly operations: readonly NodiaAiPreferenceOperation[];
  constructor(
    store: NodiaAiPreferenceService,
    authorize: AuthorizeNodiaAiUseCase,
    @Inject(NODIA_AI_DELETION_JOURNAL) deletionJournal: NodiaAiDeletionJournalPort,
  ) {
    this.operations = Object.freeze(
      (['create', 'update', 'delete'] as const).map(
        (operation) => new PreferenceOperation(operation, store, authorize, deletionJournal),
      ),
    );
  }
}
