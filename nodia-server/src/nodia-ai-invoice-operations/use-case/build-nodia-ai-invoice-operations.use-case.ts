import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { CreateInvoiceUseCase } from '../../invoice/use-case/create-invoice.use-case.js';
import { UpdateInvoiceUseCase } from '../../invoice/use-case/update-invoice.use-case.js';
import type { CreateInvoiceDto } from '../../invoice/dto/create-invoice.dto.js';
import type { UpdateInvoiceDto } from '../../invoice/dto/update-invoice.dto.js';
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
import { CanonicalizeNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/canonicalize-nodia-ai-proposal.use-case.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { NodiaAiInvoiceOperationsService } from '../nodia-ai-invoice-operations.service.js';
import {
  consumeInvoiceAttachmentStage,
  invoiceLegacyFileMediaType,
} from '../../nodia-ai-invoice-attachment/types/invoice-attachment-stage.js';
import { assertBusinessesAccess } from '../../business-access/business-access.js';

const route = '/business';
const fields = {
  business_id: 'business_id',
  provider_id: 'provider_id',
  code: 'string',
  total_amount: 'integer',
  data: 'json_object',
  is_active: 'boolean',
  attachment_id: 'uuid',
} as const;
interface Decoded {
  businessId: string;
  id?: string;
  command: NodiaAiJsonObject;
  origins: NodiaAiJsonObject;
  stagedPath?: string;
}
type Writer = (
  input: Decoded,
  context: ProposalPreparerContext,
) => Promise<{ id: string; business_id: string }>;
const invalid = (): never => {
  throw new BadRequestException('nodia_ai:invalid_input');
};
const object = (value: NodiaAiJsonValue | undefined): NodiaAiJsonObject => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid();
  return value;
};
const reviewValue = (value: NodiaAiJsonValue): NodiaAiJsonValue => {
  if (Array.isArray(value))
    return { kind: 'array', items: value.map(reviewValue) };
  if (value !== null && typeof value === 'object')
    return {
      kind: 'object',
      fields: Object.entries(value).map(([field_key, item]) => ({
        field_key,
        value: reviewValue(item),
      })),
    };
  return value;
};

/** SQL invoice metadata plus an already confirmed, separately staged private attachment. */
class InvoiceOperation implements NodiaAiNativeOperation {
  readonly resourceKey = 'invoices';
  readonly toolName: string;
  readonly contractHash: string;
  readonly catalogVersion = 'nodia-ai-ai22-business/1';
  readonly moduleRoutes = [route];
  readonly actionKeys: readonly string[] = [];
  readonly editableFields = fields;
  readonly bindableFields: Readonly<Record<string, string>> = {};
  readonly outputKeys = { id: 'invoice_id' };
  readonly reviewFields: readonly NodiaAiProposalReviewField[] = [
    {
      field_key: 'attachment_id',
      label_key: 'nodiaAi:proposal.business_fields.attachment_id',
      kind: 'text',
      nullable: false,
      max_length: 36,
      minimum: null,
      maximum: null,
      options: [],
    },
    {
      field_key: 'business_id',
      label_key: 'nodiaAi:proposal.business_fields.business_id',
      kind: 'text',
      nullable: false,
      max_length: 36,
      minimum: null,
      maximum: null,
      options: [],
    },
    {
      field_key: 'provider_id',
      label_key: 'nodiaAi:proposal.business_fields.provider_id',
      kind: 'bigint',
      nullable: true,
      max_length: null,
      minimum: '1',
      maximum: '9223372036854775807',
      options: [],
    },
    {
      field_key: 'code',
      label_key: 'nodiaAi:proposal.business_fields.code',
      kind: 'text',
      nullable: false,
      max_length: 255,
      minimum: null,
      maximum: null,
      options: [],
    },
    {
      field_key: 'total_amount',
      label_key: 'nodiaAi:proposal.business_fields.total_amount',
      kind: 'integer',
      nullable: false,
      max_length: null,
      minimum: '0',
      maximum: '2147483647',
      options: [],
    },
    {
      field_key: 'is_active',
      label_key: 'nodiaAi:proposal.business_fields.is_active',
      kind: 'boolean',
      nullable: false,
      max_length: null,
      minimum: null,
      maximum: null,
      options: [],
    },
  ];
  private readonly canonical: CanonicalizeNodiaAiProposalUseCase;
  constructor(
    readonly operation: 'create' | 'update',
    private readonly store: NodiaAiInvoiceOperationsService,
    private readonly writer: Writer,
    private readonly policy: NodiaAiRuntimePolicy,
  ) {
    this.toolName = `nodia_invoices_prepare_${operation}`;
    this.canonical = new CanonicalizeNodiaAiProposalUseCase(policy);
    this.contractHash = createHash('sha256')
      .update(
        JSON.stringify({
          version:
            operation === 'update'
              ? 'nodia-ai-invoice-staged-legacy-file/2'
              : 'nodia-ai-invoice-staged-attachment/1',
          operation,
          fields,
          scope: 'source_business_id_immutable/1',
          ...(operation === 'update'
            ? {
                transfer:
                  'public_destination_business_id_to_frozen_command_business_id+legacy_copy/2',
              }
            : {}),
          snapshot:
            'destination_business_id+businesses+provider+invoice_exact_timestamp/1',
          storage:
            'confirmed_attachment_snapshot+generation_staged_outside_sql+atomic_invoice_intent_receipt/1',
          data: 'strict_json_replace_not_merge/1',
          integer: [0, 2147483647],
          defaults: {
            provider_id: null,
            total_amount: 0,
            data: {},
            is_active: true,
          },
          review: this.reviewFields,
        }),
      )
      .digest('hex');
  }

  private authorize(context: ProposalPreparerContext) {
    if (!context.manager.queryRunner?.isTransactionActive)
      throw new ForbiddenException('authorization:transaction_required');
    if (!context.moduleRoutes.includes(route))
      throw new ForbiddenException('nodia_ai:capability_denied');
  }

  private decode(input: NodiaAiJsonObject): Decoded {
    this.canonical.execute(input);
    const stored = Object.hasOwn(input, 'schema_version');
    if (
      stored &&
      (input.schema_version !== 1 ||
        Object.keys(input).some(
          (key) =>
            ![
              'schema_version',
              'business_id',
              'id',
              'command',
              'origins',
            ].includes(key),
        ))
    )
      return invalid();
    const { business_id, id, ...rest } = input;
    if (
      typeof business_id !== 'string' ||
      !isUUID(business_id) ||
      (id !== undefined && !isFinanceBigint(id)) ||
      (this.operation === 'create' && id !== undefined)
    )
      return invalid();
    const command = { ...(stored ? object(input.command) : rest) };
    if (!stored && Object.hasOwn(command, 'destination_business_id')) {
      if (this.operation !== 'update') return invalid();
      command.business_id = command.destination_business_id;
      delete command.destination_business_id;
    }
    const origins = stored
      ? { ...object(input.origins) }
      : Object.fromEntries(Object.keys(command).map((key) => [key, 'user']));
    if (
      Object.keys(command).some((key) => !Object.hasOwn(fields, key)) ||
      Object.keys(origins).length !== Object.keys(command).length ||
      Object.keys(command).some((key) => !Object.hasOwn(origins, key))
    )
      return invalid();
    for (const [key, value] of Object.entries(command)) {
      const origin = origins[key];
      if (origin !== 'user' && origin !== 'contract_default') return invalid();
      if (
        origin === 'contract_default' &&
        !(
          this.operation === 'create' &&
          ((key === 'provider_id' && value === null) ||
            (key === 'total_amount' && value === 0) ||
            (key === 'data' && isDeepStrictEqual(value, {})) ||
            (key === 'is_active' && value === true))
        )
      )
        return invalid();
      if (
        key === 'business_id' &&
        (typeof value !== 'string' || !isUUID(value))
      )
        return invalid();
      if (key === 'business_id' && typeof value === 'string')
        command[key] = value.toLowerCase();
      if (key === 'provider_id' && value !== null && !isFinanceBigint(value))
        return invalid();
      if (
        key === 'code' &&
        (typeof value !== 'string' || value.length === 0 || value.length > 255)
      )
        return invalid();
      if (
        key === 'total_amount' &&
        (typeof value !== 'number' ||
          !Number.isInteger(value) ||
          value < 0 ||
          value > 2147483647)
      )
        return invalid();
      if (key === 'data') object(value);
      if (key === 'is_active' && typeof value !== 'boolean') return invalid();
      if (
        key === 'attachment_id' &&
        (typeof value !== 'string' || !isUUID(value, '4'))
      )
        return invalid();
    }
    return {
      businessId: business_id.toLowerCase(),
      ...(id === undefined ? {} : { id: id as string }),
      command,
      origins,
    };
  }

  private template(input: Decoded): NodiaAiJsonObject {
    return {
      schema_version: 1,
      business_id: input.businessId,
      ...(input.id === undefined ? {} : { id: input.id }),
      command: input.command,
      origins: input.origins,
    };
  }

  async prepare(
    partial: NodiaAiJsonObject,
    context: ProposalPreparerContext,
    previousPartial?: NodiaAiJsonObject,
  ): Promise<ProposalPreparation> {
    if (Object.hasOwn(partial, 'schema_version')) return invalid();
    return this.prepareInput(partial, context, previousPartial);
  }

  async reprepareStored(
    template: NodiaAiJsonObject,
    context: ProposalPreparerContext,
  ): Promise<ProposalPreparation> {
    if (template.schema_version !== 1) return invalid();
    return this.prepareInput(template, context);
  }

  private async prepareInput(
    partial: NodiaAiJsonObject,
    context: ProposalPreparerContext,
    previousPartial?: NodiaAiJsonObject,
  ): Promise<ProposalPreparation> {
    this.authorize(context);
    const previous = previousPartial ? this.decode(previousPartial) : undefined;
    let input = this.decode(
      previous && !Object.hasOwn(partial, 'schema_version')
        ? {
            ...partial,
            business_id: Object.hasOwn(partial, 'business_id')
              ? partial.business_id
              : previous.businessId,
            ...(Object.hasOwn(partial, 'id') || !previous.id
              ? {}
              : { id: previous.id }),
          }
        : partial,
    );
    if (previousPartial) {
      if (
        !previous ||
        previous.businessId !== input.businessId ||
        (previous.id && previous.id !== input.id)
      )
        return invalid();
      input = {
        ...input,
        command: { ...previous.command, ...input.command },
        origins: { ...previous.origins, ...input.origins },
      };
    }
    await this.assertDataAuthority(input, context);
    const missingFields =
      this.operation === 'create' && !Object.hasOwn(input.command, 'code')
        ? ['code']
        : [];
    if (this.operation === 'update' && !input.id) missingFields.push('id');
    if (this.operation === 'update' && !Object.keys(input.command).length)
      missingFields.push('changes');
    if (missingFields.length)
      return {
        status: 'needs_clarification',
        partial: this.template(input),
        missingFields,
        clarificationKeys: missingFields.map(
          (key) => `nodia_ai:invoice_${key}_required`,
        ),
      };
    if (this.operation === 'create') {
      for (const [key, value] of Object.entries({
        provider_id: null,
        total_amount: 0,
        data: {},
        is_active: true,
      }))
        if (!Object.hasOwn(input.command, key)) {
          input.command[key] = value;
          input.origins[key] = 'contract_default';
        }
    }
    const preconditions = await this.snapshot(input, context);
    const target =
      preconditions.target === null ? null : object(preconditions.target);
    const changes = Object.entries(input.command).map(([field_key, after]) => ({
      field_key,
      before:
        target && field_key !== 'attachment_id'
          ? reviewValue(target[field_key])
          : null,
      before_present: target !== null && field_key !== 'attachment_id',
      after: reviewValue(after),
      after_present: true,
      origin: input.origins[field_key],
    }));
    const destination = String(input.command.business_id ?? input.businessId);
    if (!Object.hasOwn(input.command, 'business_id'))
      changes.unshift({
        field_key: 'business_id',
        before: target?.business_id ?? null,
        before_present: target !== null,
        after: destination,
        after_present: true,
        origin: 'database',
      });
    changes.push({
      field_key: 'file_attached',
      before: target ? target.path_storage !== '' : null,
      before_present: target !== null,
      after: input.command.attachment_id
        ? true
        : target
          ? target.path_storage !== ''
          : false,
      after_present: true,
      origin: 'database',
    });
    if (
      target &&
      target.path_storage !== '' &&
      !input.command.attachment_id &&
      destination !== input.businessId
    )
      changes.push({
        field_key: 'file_preserved',
        before: true,
        before_present: true,
        after: true,
        after_present: true,
        origin: 'database',
      });
    if (preconditions.attachment) {
      const attachment = object(preconditions.attachment);
      for (const key of [
        'file_name',
        'media_type',
        'byte_count',
        'content_hash',
      ])
        changes.push({
          field_key: `attachment_${key}`,
          before: null,
          before_present: false,
          after: attachment[key],
          after_present: true,
          origin: 'database',
        });
    }
    const publicStep: NodiaAiJsonObject = {
      tool_name: this.toolName,
      kind: 'domain_change',
      target: target
        ? { resource_key: 'invoices', id: input.id!, label: target.code }
        : null,
      scope: { business_id: input.businessId },
      changes,
      depends_on: [],
      effect_key: `invoices.${this.operation}`,
      output_bindings: [],
    };
    this.boundedReview(publicStep);
    return {
      status: 'ready',
      commandTemplate: this.template(input),
      scope: { business_id: input.businessId },
      preconditions,
      publicStep,
    };
  }

  async applyEdits(
    template: NodiaAiJsonObject,
    edits: readonly ProposalFieldEdit[],
    context: ProposalPreparerContext,
  ): Promise<NodiaAiJsonObject> {
    this.authorize(context);
    const input = this.decode(template);
    const seen = new Set<string>();
    for (const edit of edits) {
      if (!Object.hasOwn(fields, edit.field_key) || seen.has(edit.field_key))
        return invalid();
      seen.add(edit.field_key);
      input.command[edit.field_key] = edit.value;
      input.origins[edit.field_key] = 'user';
    }
    const checked = this.decode(this.template(input));
    await this.assertDataAuthority(checked, context);
    return this.template(checked);
  }

  async verifyAuthority(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<void> {
    this.authorize(context);
    const input = this.decode(step.commandTemplate);
    if (
      step.toolName !== this.toolName ||
      step.contractHash !== this.contractHash ||
      Object.keys(step.scope).length !== 1 ||
      step.scope.business_id !== input.businessId
    )
      throw new ForbiddenException('nodia_ai:capability_denied');
    await this.assertDataAuthority(input, context);
    // Historical receipts need current visibility, not unchanged business values.
    // A deleted invoice has no new destination; the original business still gates it.
  }

  async verifyPreconditions(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<void> {
    await this.verifyAuthority(step, context);
    let current: NodiaAiJsonObject;
    try {
      current = await this.snapshot(this.decode(step.commandTemplate), context);
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
  }

  async executeConfirmed(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<{ id: string; businessId: string }> {
    const input = this.decode(step.commandTemplate);
    if (
      !isDeepStrictEqual(step.commandTemplate, this.template(input)) ||
      step.outputBindings.length ||
      !Array.isArray(step.publicStep.depends_on) ||
      step.publicStep.depends_on.length ||
      (this.operation === 'update' &&
        (!input.id || !Object.keys(input.command).length)) ||
      (this.operation === 'create' &&
        ['code', 'provider_id', 'total_amount', 'data', 'is_active'].some(
          (key) => !Object.hasOwn(input.command, key),
        ))
    )
      return invalid();
    await this.verifyPreconditions(step, context);
    const target = step.preconditions.target;
    const legacy =
      target &&
      typeof target === 'object' &&
      !Array.isArray(target) &&
      target.path_storage !== '' &&
      step.preconditions.destination_business_id !== input.businessId;
    if (input.command.attachment_id || legacy)
      input.stagedPath = await consumeInvoiceAttachmentStage(
        context.manager,
        step,
        typeof input.command.attachment_id === 'string'
          ? input.command.attachment_id
          : null,
      );
    const result = await this.writer(input, context);
    if (input.stagedPath) {
      await context.manager.query(
        'DELETE FROM invoice_uploads WHERE storage_key=$1',
        [input.stagedPath],
      );
      await context.manager.query(
        'UPDATE nodia_ai_execution_steps SET recovery_descriptor=NULL WHERE id=$1',
        [step.id],
      );
      if (
        target &&
        typeof target === 'object' &&
        !Array.isArray(target) &&
        typeof target.path_storage === 'string' &&
        target.path_storage &&
        target.path_storage !== input.stagedPath
      )
        await context.manager.query(
          `INSERT INTO invoice_uploads(storage_key,cleanup_after,retry_after)
          VALUES($1,clock_timestamp()+interval '10 minutes',clock_timestamp()+interval '10 minutes') ON CONFLICT(storage_key) DO NOTHING`,
          [target.path_storage],
        );
    }
    const destination = String(input.command.business_id ?? input.businessId);
    if (
      !isFinanceBigint(result.id) ||
      result.business_id !== destination ||
      (this.operation === 'update' && result.id !== input.id)
    )
      throw new InternalServerErrorException('nodia_ai:invalid_output');
    return { id: result.id, businessId: destination };
  }

  private boundedReview(value: NodiaAiJsonObject) {
    if (
      Buffer.byteLength(this.canonical.execute(value), 'utf8') >
      this.policy.results.tool_result_utf8_bytes
    )
      throw new ConflictException('nodia_ai:result_too_large');
  }

  private async snapshot(
    input: Decoded,
    context: ProposalPreparerContext,
  ): Promise<NodiaAiJsonObject> {
    await this.assertDataAuthority(input, context);
    const first = input.id
      ? await this.store.target(context.manager, input.id)
      : null;
    if (this.operation === 'update' && !first)
      throw new NotFoundException('nodia_ai:invoice_not_found');
    if (first && first.business_id !== input.businessId)
      throw new ConflictException('nodia_ai:invoice_business_mismatch');
    const destination = String(input.command.business_id ?? input.businessId);
    if (
      first &&
      destination !== input.businessId &&
      first.path_storage !== '' &&
      !input.command.attachment_id
    )
      invoiceLegacyFileMediaType(first.path_storage, first.business_id);
    const ids = [...new Set([input.businessId, destination])].sort();
    const businesses = await this.store.businesses(context.manager, ids);
    if (businesses.length !== ids.length)
      throw new NotFoundException('nodia_ai:business_not_found');
    const providerId = Object.hasOwn(input.command, 'provider_id')
      ? input.command.provider_id
      : first?.provider_id;
    const provider =
      providerId == null
        ? null
        : await this.store.provider(context.manager, String(providerId));
    if (providerId != null && !provider)
      throw new NotFoundException('nodia_ai:provider_not_found');
    if (provider && provider.business_id !== destination)
      throw new ConflictException('nodia_ai:provider_business_mismatch');
    const target = input.id
      ? await this.store.target(context.manager, input.id, true)
      : null;
    if (!isDeepStrictEqual(first, target))
      throw new ConflictException('nodia_ai:preconditions_changed');
    const snapshot: NodiaAiJsonObject = {
      schema_version: 1,
      destination_business_id: destination,
      target,
      businesses,
      provider,
      ...(input.command.attachment_id
        ? {
            attachment: await this.store.attachment(
              context.manager,
              String(input.command.attachment_id),
              context.conversationId,
              context.actor.actorId,
            ),
          }
        : {}),
    };
    this.boundedReview(snapshot);
    return snapshot;
  }

  private async assertDataAuthority(
    input: Decoded,
    context: ProposalPreparerContext,
  ): Promise<void> {
    const actor = {
      userId: context.actor.actorId,
      sessionId: context.actor.sessionId,
      transaction: context.manager,
      statementTimeoutMs: context.statementTimeoutMs,
    };
    const destination = String(input.command.business_id ?? input.businessId);
    await assertBusinessesAccess(
      context.manager,
      actor,
      [input.businessId, destination],
      { lock: true },
    );
    if (input.id) {
      const current = await this.store.target(context.manager, input.id);
      if (current)
        await assertBusinessesAccess(
          context.manager,
          actor,
          [String(current.business_id)],
          { lock: true },
        );
    }
  }
}

@Injectable()
export class BuildNodiaAiInvoiceOperationsUseCase {
  readonly operations: readonly NodiaAiNativeOperation[];
  constructor(
    store: NodiaAiInvoiceOperationsService,
    create: CreateInvoiceUseCase,
    update: UpdateInvoiceUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY) policy: NodiaAiRuntimePolicy,
  ) {
    this.operations = Object.freeze([
      new InvoiceOperation(
        'create',
        store,
        (input, context) =>
          create.execute(
            {
              ...Object.fromEntries(
                Object.entries(input.command).filter(
                  ([key]) => key !== 'attachment_id',
                ),
              ),
              business_id: String(
                input.command.business_id ?? input.businessId,
              ),
              path_storage: input.stagedPath ?? '',
            } as unknown as CreateInvoiceDto,
            undefined,
            context.manager,
            {
              userId: context.actor.actorId,
              sessionId: context.actor.sessionId,
              transaction: context.manager,
            },
          ),
        policy,
      ),
      new InvoiceOperation(
        'update',
        store,
        (input, context) =>
          update.execute(
            input.id!,
            {
              ...Object.fromEntries(
                Object.entries(input.command).filter(
                  ([key]) => key !== 'attachment_id',
                ),
              ),
              ...(input.stagedPath ? { path_storage: input.stagedPath } : {}),
            } as UpdateInvoiceDto,
            context.manager,
            {
              userId: context.actor.actorId,
              sessionId: context.actor.sessionId,
              transaction: context.manager,
            },
          ),
        policy,
      ),
    ]);
  }
}
