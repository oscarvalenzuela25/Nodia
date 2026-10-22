import {
  BadRequestException,
  ConflictException,
  GoneException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { withCoreAuthorityLock } from '../../authorization/core-authority-transaction.js';
import { GetNodiaAiExecutionUseCase } from '../../nodia-ai-confirmation/use-case/get-nodia-ai-execution.use-case.js';
import {
  ValidateNodiaAiProposalUseCase,
  storedStep,
} from '../../nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js';
import { NodiaAiExecutionService } from '../../nodia-ai-execution/nodia-ai-execution.service.js';
import { nodiaAiSecureOperationIdentity } from '../../nodia-ai-proposal/types/secure-operation.types.js';
import { lockNodiaAiQueue } from '../../nodia-ai-runtime/queue-lock.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { NodiaAiExecution } from '../../nodia-ai-confirmation/entities/nodia-ai-execution.entity.js';
import { NodiaAiExecutionStep } from '../../nodia-ai-confirmation/entities/nodia-ai-execution-step.entity.js';
import { NodiaAiJob } from '../../nodia-ai-runtime/entities/nodia-ai-job.entity.js';
import { NodiaAiExecutionGrant } from '../../nodia-ai-runtime/entities/nodia-ai-execution-grant.entity.js';
import { appendNodiaAiExecutionEvent } from '../../nodia-ai-run/event-journal.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { SaveAiApiKeyUseCase } from '../../ai-provider/use-case/save-ai-api-key.use-case.js';
import { ManageAiProviderSecureSessionUseCase } from '../../ai-provider/use-case/manage-ai-provider-secure-session.use-case.js';
import type {
  AiProviderSecureReference,
  AiProviderSecureMode,
  AiProviderSecureRequest,
} from '../../ai-provider/use-case/manage-ai-provider-secure-session.use-case.js';
import type { CreateAiApiKeyDto } from '../../ai-provider/dto/create-ai-api-key.dto.js';
import type { UpdateAiApiKeyDto } from '../../ai-provider/dto/update-ai-api-key.dto.js';
import type { GeminiLoginInput } from '../../common/ai/gemini-login-viewer.js';
import { validateGeminiLoginInput } from '../../ai-provider/use-case/manage-gemini-login.use-case.js';
import { NodiaAiSecureFlowActionDto } from '../dto/nodia-ai-secure-flow.dto.js';
import { RevokeOwnAuthSessionUseCase } from '../../auth/use-case/revoke-own-auth-session.use-case.js';
import {
  secureDescriptor,
  secureFlowReceipt,
  secureObject,
  secureUuid,
  type SecureFlowAction,
} from '../types/secure-flow.types.js';
import {
  acknowledgeSecureFlow,
  secureFlowAcknowledgement,
  type SecureFlowAcknowledgement,
} from '../acknowledge-secure-flow.js';

type Request = {
  expected_execution_revision: number;
  client_request_id: string;
  payload?: NodiaAiJsonObject;
};
const readActions: readonly SecureFlowAction[] = ['status', 'frame'];
/** Trusted human channel. Secret payloads are consumed once in memory, never persisted or journaled. */
@Injectable()
export class ManageNodiaAiSecureFlowUseCase {
  constructor(
    private readonly store: NodiaAiExecutionService,
    private readonly status: GetNodiaAiExecutionUseCase,
    private readonly proposals: ValidateNodiaAiProposalUseCase,
    private readonly keys: SaveAiApiKeyUseCase,
    private readonly native: ManageAiProviderSecureSessionUseCase,
    private readonly revoke: RevokeOwnAuthSessionUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}

  async get(identity: NodiaAiActorReference, executionId: string) {
    return this.store.transaction(async (manager) => {
      await lockAuthority(
        manager,
        false,
        this.policy.timing.read_query_seconds * 1000,
      );
      await lockNodiaAiQueue(manager);
      const flow = await this.load(manager, identity, executionId);
      return { flow: this.project(flow) };
    });
  }
  async execute(
    identity: NodiaAiActorReference,
    executionId: string,
    reference: string,
    action: string,
    input: unknown,
  ) {
    if (
      !secureUuid.test(reference) ||
      ![
        'key',
        'delete',
        'start',
        'status',
        'code',
        'frame',
        'input',
        'cancel',
        'logout',
        'sync',
      ].includes(action)
    )
      throw new BadRequestException('nodia_ai:invalid_input');
    const request = this.request(input);
    const operation = action as SecureFlowAction;
    if (
      operation === 'key' ||
      operation === 'delete' ||
      operation === 'logout'
    ) {
      const hint = await this.get(identity, executionId);
      if (
        operation !== 'logout' ||
        (operation === 'logout' && hint.flow.kind === 'nodia_logout')
      )
        return this.local(identity, executionId, reference, operation, request);
    }
    return this.remote(identity, executionId, reference, operation, request);
  }
  private request(input: unknown): Request {
    if (
      input &&
      typeof input === 'object' &&
      Object.getPrototypeOf(input) === NodiaAiSecureFlowActionDto.prototype
    ) {
      const entries = Object.getOwnPropertyDescriptors(input);
      if (
        Reflect.ownKeys(input).some(
          (key) =>
            typeof key !== 'string' ||
            !entries[key]?.enumerable ||
            !Object.hasOwn(entries[key], 'value'),
        )
      )
        throw new BadRequestException('nodia_ai:invalid_input');
      input = Object.fromEntries(
        Object.entries(entries).map(([key, entry]) => [
          key,
          entry.value as unknown,
        ]),
      );
    }
    if (
      !secureObject(input) ||
      Object.keys(input).some(
        (key) =>
          ![
            'expected_execution_revision',
            'client_request_id',
            'payload',
          ].includes(key),
      ) ||
      !Number.isSafeInteger(input.expected_execution_revision) ||
      Number(input.expected_execution_revision) < 1 ||
      Number(input.expected_execution_revision) > 2147483646 ||
      typeof input.client_request_id !== 'string' ||
      !secureUuid.test(input.client_request_id) ||
      (input.payload !== undefined && !secureObject(input.payload)) ||
      Buffer.byteLength(JSON.stringify(input)) >
        this.policy.admission.http_json_bytes
    )
      throw new BadRequestException('nodia_ai:invalid_input');
    return input as Request;
  }
  private async load(
    manager: EntityManager,
    identity: NodiaAiActorReference,
    id: string,
  ) {
    const loaded = await this.status.authorize(manager, identity, id, 'write');
    const jobs = await this.store.jobs(manager, id),
      execution = await this.store.execution(manager, id, true),
      steps = await this.store.steps(manager, id),
      grants = await this.store.grants(manager, id);
    const job = jobs[0],
      step = steps[0],
      grant = grants[0],
      source = loaded.steps[0],
      now = await this.store.now(manager);
    if (
      !execution ||
      jobs.length !== 1 ||
      steps.length !== 1 ||
      loaded.steps.length !== 1 ||
      grants.length !== 1 ||
      !job ||
      job.recovery_descriptor?.restore_quarantined !== undefined ||
      !step ||
      !grant ||
      !source ||
      !nodiaAiSecureOperationIdentity(source.tool_name) ||
      execution.actor_id !== loaded.actor.actorId ||
      execution.actor_id !== loaded.chat.owner_id ||
      execution.retention_epoch !== loaded.chat.retention_epoch ||
      grant.actor_id !== loaded.actor.actorId ||
      grant.session_public_id !== loaded.actor.sessionId ||
      grant.command_set_hash !== execution.proposal_hash ||
      grant.execution_id !== execution.id ||
      grant.run_id !== null ||
      grant.policy_version !== this.policy.policyVersion ||
      !this.proposals.equal(grant.allowed_operations, [source.tool_name]) ||
      !this.proposals.equal(
        grant.allowed_modules,
        [
          ...this.proposals.preparer(source.tool_name, source.contract_hash)
            .moduleRoutes,
        ].sort(),
      ) ||
      !this.proposals.equal(grant.allowed_scope, execution.minimal_scope) ||
      step.source_step_id !== source.id ||
      step.id !== source.id ||
      step.execution_id !== execution.id ||
      job.conversation_id !== loaded.chat.id ||
      job.execution_id !== execution.id ||
      job.kind !== 'execution'
    )
      throw new NotFoundException('nodia_ai:operation_not_found');
    const descriptor = secureDescriptor(step.recovery_descriptor);
    if (
      descriptor.native_request &&
      (descriptor.native_request.request_id !== step.native_request_key ||
        descriptor.native_request.provider_id !==
          source.command_template.provider_id ||
        descriptor.native_request.provider_key !==
          source.preconditions.provider_key ||
        descriptor.native_request.mode !== source.command_template.mode)
    )
      throw new NotFoundException('nodia_ai:operation_not_found');
    if (
      descriptor.actor_id !== loaded.actor.actorId ||
      descriptor.session_id !== loaded.actor.sessionId ||
      descriptor.flow_kind !==
        nodiaAiSecureOperationIdentity(source.tool_name)?.kind
    )
      throw new NotFoundException('nodia_ai:operation_not_found');
    await this.status.project(manager, execution, now, loaded.steps);
    return { loaded, job, execution, step, grant, source, now, descriptor };
  }
  private project(
    flow: Awaited<ReturnType<ManageNodiaAiSecureFlowUseCase['load']>>,
  ) {
    const template = flow.source.command_template;
    return {
      reference: flow.descriptor.reference,
      kind: flow.descriptor.flow_kind,
      provider_id:
        typeof template.provider_id === 'string' ? template.provider_id : null,
      key_id: typeof template.key_id === 'string' ? template.key_id : null,
      provider_key:
        typeof flow.source.preconditions.provider_key === 'string'
          ? flow.source.preconditions.provider_key
          : null,
      mode: typeof template.mode === 'string' ? template.mode : null,
      expires_at: flow.descriptor.expires_at,
      status:
        flow.descriptor.status === 'waiting' &&
        flow.now >= new Date(flow.descriptor.expires_at)
          ? 'expired'
          : flow.descriptor.status,
      revision: flow.execution.revision,
    };
  }
  private assertRequest(
    flow: Awaited<ReturnType<ManageNodiaAiSecureFlowUseCase['load']>>,
    reference: string,
    request: Request,
    action: SecureFlowAction,
  ) {
    if (flow.descriptor.reference !== reference)
      throw new NotFoundException('nodia_ai:operation_not_found');
    if (flow.descriptor.request_id === request.client_request_id) {
      if (
        flow.descriptor.request_action !== action ||
        flow.descriptor.request_revision !== request.expected_execution_revision
      )
        throw new ConflictException('nodia_ai:request_conflict');
      return 'replay' as const;
    }
    if (flow.execution.revision !== request.expected_execution_revision)
      throw new ConflictException('nodia_ai:revision_conflict');
    if (flow.execution.revision >= 2147483647)
      throw new ConflictException('nodia_ai:execution_limit');
    if (
      flow.now >= new Date(flow.descriptor.expires_at) ||
      flow.job.deadline_at <= flow.now ||
      flow.grant.expires_at <= flow.now
    )
      throw new GoneException('nodia_ai:secure_flow_expired');
    if (
      flow.grant.revoked_at ||
      flow.execution.state !== 'waiting_for_user' ||
      flow.step.state !== 'waiting_for_user' ||
      flow.job.state !== 'waiting' ||
      flow.loaded.chat.active_job_id !== flow.job.id ||
      flow.job.lease_owner !== null ||
      flow.job.lease_until !== null
    )
      throw new ConflictException('nodia_ai:execution_conflict');
    return 'new' as const;
  }
  private async local(
    identity: NodiaAiActorReference,
    id: string,
    reference: string,
    action: SecureFlowAction,
    request: Request,
  ) {
    return this.store.transaction(async (manager) => {
      const work = async () => {
        await lockNodiaAiQueue(manager);
        const flow = await this.load(manager, identity, id);
        if (this.assertRequest(flow, reference, request, action) === 'replay')
          return { flow: this.project(flow) };
        if (flow.descriptor.status !== 'waiting')
          throw new ConflictException('nodia_ai:secure_flow_busy');
        // The exact snapshot and its native writer share the configuration frontier.
        if (action === 'key' || action === 'delete')
          await manager.query(
            'LOCK TABLE ai_provider_catalog, ai_providers IN SHARE ROW EXCLUSIVE MODE',
          );
        if (action !== 'cancel')
          await this.proposals
            .preparer(flow.source.tool_name, flow.source.contract_hash)
            .verifyPreconditions(storedStep(flow.source), flow.loaded.context);
        const template = flow.source.command_template,
          kind = flow.descriptor.flow_kind;
        const actor: ActorReference = {
          ...identity,
          transaction: manager,
          statementTimeoutMs: this.policy.timing.read_query_seconds * 1000,
        };
        if (action === 'cancel') {
          if (
            request.payload !== undefined ||
            flow.descriptor.native_reference !== null
          )
            throw new ConflictException('nodia_ai:secure_flow_busy');
          flow.descriptor.request_id = request.client_request_id;
          flow.descriptor.request_action = action;
          flow.descriptor.request_revision =
            request.expected_execution_revision;
          await this.finish(manager, flow, 'cancelled');
          return { flow: this.project(flow) };
        } else if (
          action === 'key' &&
          (kind === 'api_key_create' || kind === 'api_key_update')
        ) {
          if (
            !request.payload ||
            Object.keys(request.payload).some((key) => key !== 'secret') ||
            (request.payload.secret !== undefined &&
              (typeof request.payload.secret !== 'string' ||
                !request.payload.secret.length ||
                request.payload.secret.length > 8192)) ||
            (kind === 'api_key_create' && request.payload.secret === undefined)
          )
            throw new BadRequestException('nodia_ai:invalid_input');
          const command = secureObject(template.command)
            ? template.command
            : {};
          const target = secureObject(flow.source.preconditions.target)
            ? flow.source.preconditions.target
            : {};
          const changesMetadata = Object.entries(command).some(
            ([field, value]) =>
              !Object.hasOwn(target, field) ||
              !this.proposals.equal(value, target[field]),
          );
          if (
            kind === 'api_key_update' &&
            request.payload.secret === undefined &&
            !changesMetadata
          )
            throw new BadRequestException('nodia_ai:invalid_input');
          const dto: CreateAiApiKeyDto | UpdateAiApiKeyDto =
            kind === 'api_key_create'
              ? ({
                  ...command,
                  provider_id: String(template.provider_id),
                  ...(request.payload.secret === undefined
                    ? {}
                    : { secret: request.payload.secret }),
                } as CreateAiApiKeyDto)
              : ({
                  ...command,
                  ...(request.payload.secret === undefined
                    ? {}
                    : { secret: request.payload.secret }),
                } as UpdateAiApiKeyDto);
          await this.keys.execute(
            typeof template.key_id === 'string' ? template.key_id : undefined,
            dto,
            actor,
          );
        } else if (action === 'delete' && kind === 'api_key_delete') {
          if (
            request.payload !== undefined ||
            typeof template.key_id !== 'string'
          )
            throw new BadRequestException('nodia_ai:invalid_input');
          await this.keys.remove(template.key_id, actor);
        } else if (action === 'logout' && kind === 'nodia_logout') {
          if (request.payload !== undefined)
            throw new BadRequestException('nodia_ai:invalid_input');
          await this.revoke.execute(actor);
        } else throw new BadRequestException('nodia_ai:invalid_input');
        flow.descriptor.request_id = request.client_request_id;
        flow.descriptor.request_action = action;
        flow.descriptor.request_revision = request.expected_execution_revision;
        await this.finish(manager, flow, 'completed');
        return { flow: this.project(flow) };
      };
      if (action === 'logout')
        return withCoreAuthorityLock(
          manager,
          this.policy.timing.read_query_seconds * 1000,
          work,
        );
      await lockAuthority(
        manager,
        false,
        this.policy.timing.read_query_seconds * 1000,
      );
      return work();
    });
  }
  private async remote(
    identity: NodiaAiActorReference,
    id: string,
    reference: string,
    action: SecureFlowAction,
    request: Request,
  ) {
    const admitted = await this.store.transaction(async (manager) => {
      await lockAuthority(
        manager,
        false,
        this.policy.timing.read_query_seconds * 1000,
      );
      await lockNodiaAiQueue(manager);
      const flow = await this.load(manager, identity, id);
      if (this.assertRequest(flow, reference, request, action) === 'replay')
        return { replay: true as const, flow };
      // Untouched forms have no native operation to fence. A reserved request must use native cancellation.
      if (
        action === 'cancel' &&
        flow.descriptor.status === 'waiting' &&
        flow.descriptor.native_reference === null &&
        !flow.descriptor.native_request
      ) {
        if (request.payload !== undefined)
          throw new BadRequestException('nodia_ai:invalid_input');
        flow.descriptor.request_id = request.client_request_id;
        flow.descriptor.request_action = action;
        flow.descriptor.request_revision = request.expected_execution_revision;
        await this.finish(manager, flow, 'cancelled');
        return { replay: true as const, flow };
      }
      const kind = flow.descriptor.flow_kind;
      if (
        ![
          'connection_login',
          'codex_logout',
          'gemini_web_logout',
          'sync_models',
        ].includes(kind) ||
        (kind !== 'connection_login' &&
          action !== (kind === 'sync_models' ? 'sync' : 'logout')) ||
        (kind === 'connection_login' &&
          !['start', 'status', 'frame', 'code', 'input', 'cancel'].includes(
            action,
          ))
      )
        throw new BadRequestException('nodia_ai:invalid_input');
      if (
        ['completed', 'cancelled', 'expired', 'failed'].includes(
          flow.descriptor.status,
        ) ||
        (flow.descriptor.status === 'invoking' &&
          !(
            flow.descriptor.native_request &&
            ['status', 'cancel'].includes(action)
          )) ||
        (flow.descriptor.status === 'unknown' &&
          !['status', 'frame', 'cancel'].includes(action)) ||
        (action === 'start' &&
          (flow.descriptor.status !== 'waiting' ||
            flow.descriptor.native_reference !== null ||
            flow.descriptor.native_request != null)) ||
        (['frame', 'code', 'input'].includes(action) &&
          !flow.descriptor.native_reference) ||
        (['status', 'cancel'].includes(action) &&
          !flow.descriptor.native_reference &&
          !flow.descriptor.native_request)
      )
        throw new ConflictException('nodia_ai:secure_flow_busy');
      if (!['code', 'input'].includes(action) && request.payload !== undefined)
        throw new BadRequestException('nodia_ai:invalid_input');
      if (
        action === 'code' &&
        (!request.payload ||
          Object.keys(request.payload).join(',') !== 'code' ||
          typeof request.payload.code !== 'string')
      )
        throw new BadRequestException('nodia_ai:invalid_input');
      if (action === 'code') {
        if (
          flow.descriptor.native_reference?.provider_key !== 'gemini' ||
          flow.descriptor.native_reference.mode !== 'token_plan_agentic'
        )
          throw new BadRequestException('nodia_ai:invalid_input');
        const code = String(request.payload!.code).trim();
        if (!/^[A-Za-z0-9_./+~-]{8,2048}$/.test(code))
          throw new BadRequestException('nodia_ai:invalid_input');
        request.payload!.code = code;
      }
      if (action === 'input') {
        if (
          !request.payload ||
          Object.keys(request.payload).some(
            (key) =>
              ![
                'action',
                'frame_id',
                'x',
                'y',
                'text',
                'key',
                'delta',
              ].includes(key),
          ) ||
          typeof request.payload.action !== 'string' ||
          typeof request.payload.frame_id !== 'string' ||
          flow.descriptor.native_reference?.provider_key !== 'gemini' ||
          flow.descriptor.native_reference.mode !== 'token_plan_web'
        )
          throw new BadRequestException('nodia_ai:invalid_input');
        validateGeminiLoginInput(
          request.payload as unknown as GeminiLoginInput,
        );
      }
      if (action !== 'cancel' && !readActions.includes(action))
        await this.proposals
          .preparer(flow.source.tool_name, flow.source.contract_hash)
          .verifyPreconditions(storedStep(flow.source), flow.loaded.context);
      if (!readActions.includes(action)) {
        if (action === 'start') {
          const mode = flow.source.command_template.mode,
            key = flow.source.preconditions.provider_key,
            providerId = flow.source.command_template.provider_id;
          if (
            typeof providerId !== 'string' ||
            !['gemini', 'openai'].includes(String(key)) ||
            !['token_plan_web', 'token_plan_agentic'].includes(String(mode))
          )
            throw new ConflictException('nodia_ai:execution_conflict');
          flow.descriptor.native_request = {
            request_id: flow.step.native_request_key,
            provider_id: providerId,
            provider_key: key as 'gemini' | 'openai',
            mode: mode as 'token_plan_web' | 'token_plan_agentic',
          };
          secureDescriptor(flow.descriptor);
        }
        flow.descriptor.status = 'invoking';
        flow.descriptor.request_id = request.client_request_id;
        flow.descriptor.request_action = action;
        flow.descriptor.request_revision = request.expected_execution_revision;
        flow.step.recovery_descriptor = flow.descriptor;
        flow.execution.revision++;
        await manager.getRepository(NodiaAiExecutionStep).save(flow.step);
        await manager.getRepository(NodiaAiExecution).save(flow.execution);
      }
      return { replay: false as const, flow };
    });
    if (admitted.replay) return { flow: this.project(admitted.flow) };
    const flow = admitted.flow,
      template = flow.source.command_template,
      providerId = String(template.provider_id),
      mode = (template.mode ??
        (flow.descriptor.flow_kind === 'gemini_web_logout'
          ? 'token_plan_web'
          : 'token_plan_agentic')) as AiProviderSecureMode;
    const ref = flow.descriptor
      .native_reference as unknown as AiProviderSecureReference;
    let observedReference: NodiaAiJsonObject | undefined;
    let acknowledgement: SecureFlowAcknowledgement | null = null;
    try {
      let result:
        | Awaited<ReturnType<ManageAiProviderSecureSessionUseCase['start']>>
        | undefined;
      let frame: unknown,
        discovered:
          | Awaited<
              ReturnType<ManageAiProviderSecureSessionUseCase['discover']>
            >
          | undefined;
      if (action === 'start')
        result = await this.native.start(
          providerId,
          mode,
          identity,
          flow.descriptor.native_request!.request_id,
          flow.descriptor.expires_at,
        );
      else if (action === 'status') {
        result = flow.descriptor.native_request
          ? ((await this.native.observeRequest(
              flow.descriptor.native_request as AiProviderSecureRequest,
              identity.userId,
            )) ?? undefined)
          : await this.native.status(ref, identity);
        if (!result)
          throw new ConflictException('nodia_ai:secure_flow_unknown');
      } else if (action === 'code')
        result = await this.native.submitCode(
          ref,
          String(request.payload?.code),
          identity,
        );
      else if (action === 'input')
        result = await this.native.input(
          ref,
          request.payload as unknown as GeminiLoginInput,
          identity,
        );
      else if (action === 'cancel')
        result = flow.descriptor.native_request
          ? await this.native.cancelRequest(
              flow.descriptor.native_request as AiProviderSecureRequest,
              identity.userId,
            )
          : await this.native.cancel(ref, identity);
      else if (action === 'frame')
        frame = await this.native.frame(ref, identity);
      else if (action === 'logout')
        await this.native.logout(providerId, mode, identity);
      else if (action === 'sync')
        discovered = await this.native.discover(providerId, mode, identity);
      if (result)
        observedReference = result.reference as unknown as NodiaAiJsonObject;
      const response = await this.store.transaction(async (manager) => {
        await lockAuthority(
          manager,
          false,
          this.policy.timing.read_query_seconds * 1000,
        );
        await lockNodiaAiQueue(manager);
        const current = await this.load(manager, identity, id);
        if (
          current.descriptor.reference !== reference ||
          current.execution.revision !== flow.execution.revision ||
          current.execution.state !== 'waiting_for_user' ||
          current.step.state !== 'waiting_for_user' ||
          current.job.state !== 'waiting' ||
          (!readActions.includes(action) &&
            current.descriptor.request_id !== request.client_request_id)
        )
          throw new ConflictException('nodia_ai:execution_conflict');
        if (
          current.now >= new Date(current.descriptor.expires_at) ||
          current.job.deadline_at <= current.now ||
          current.grant.expires_at <= current.now ||
          current.grant.revoked_at ||
          current.loaded.chat.expires_at <= current.now ||
          current.loaded.chat.active_job_id !== current.job.id ||
          current.job.lease_owner !== null ||
          current.job.lease_until !== null
        )
          throw new GoneException('nodia_ai:secure_flow_expired');
        if (action === 'sync')
          await manager.query(
            'LOCK TABLE ai_provider_catalog, ai_providers IN SHARE ROW EXCLUSIVE MODE',
          );
        if (action !== 'cancel' && !readActions.includes(action))
          await this.proposals
            .preparer(current.source.tool_name, current.source.contract_hash)
            .verifyPreconditions(
              storedStep(current.source),
              current.loaded.context,
            );
        if (result) {
          current.descriptor.native_reference =
            result.reference as unknown as NodiaAiJsonObject;
          secureDescriptor(current.descriptor);
          if (result.state === 'completed')
            await this.finish(manager, current, 'completed');
          else if (
            result.state === 'cancelled' ||
            result.state === 'expired' ||
            result.state === 'failed'
          )
            await this.finish(manager, current, result.state);
          else {
            current.descriptor.status = 'pending';
            current.step.recovery_descriptor = current.descriptor;
            current.execution.revision++;
            await manager
              .getRepository(NodiaAiExecutionStep)
              .save(current.step);
            await manager
              .getRepository(NodiaAiExecution)
              .save(current.execution);
          }
        } else if (action === 'logout' || action === 'sync') {
          if (action === 'sync') {
            if (!discovered || discovered.providerId !== providerId)
              throw new ConflictException('nodia_ai:secure_flow_unknown');
            await this.native.commitDiscovery(
              manager,
              identity,
              providerId,
              mode,
              discovered.models,
            );
          }
          await this.finish(manager, current, 'completed');
        }
        acknowledgement = secureFlowAcknowledgement(
          current.execution.id,
          current.execution.revision,
          current.descriptor,
        );
        return {
          flow: this.project(current),
          ...(result ? { interaction: result.human } : {}),
          ...(frame !== undefined ? { frame } : {}),
        };
      });
      await acknowledgeSecureFlow(this.store, this.native, acknowledgement);
      return response;
    } catch (error) {
      if (!readActions.includes(action))
        await this.markUnknown(
          id,
          reference,
          request.client_request_id,
          error,
          observedReference,
        );
      throw error instanceof HttpException
        ? error
        : new ConflictException('nodia_ai:secure_flow_unknown');
    }
  }
  private async finish(
    manager: EntityManager,
    flow: Awaited<ReturnType<ManageNodiaAiSecureFlowUseCase['load']>>,
    state: 'completed' | 'cancelled' | 'expired' | 'failed',
  ) {
    const now = await this.store.now(manager);
    flow.descriptor.status = state;
    flow.step.recovery_descriptor = flow.descriptor;
    flow.step.state = state === 'expired' ? 'failed' : state;
    flow.step.completed_at = state === 'completed' ? now : null;
    flow.step.dispatched_at = state === 'completed' ? now : null;
    flow.step.minimal_receipt =
      state === 'completed' ? secureFlowReceipt(flow.descriptor) : null;
    flow.execution.state = state === 'expired' ? 'failed' : state;
    flow.execution.revision++;
    flow.execution.completed_at = state === 'completed' ? now : null;
    flow.job.state =
      state === 'completed'
        ? 'done'
        : state === 'expired' || state === 'failed'
          ? 'failed'
          : 'cancelled';
    flow.job.lease_owner = null;
    flow.job.lease_until = null;
    flow.job.updated_at = now;
    flow.grant.revoked_at = now;
    await manager.getRepository(NodiaAiExecutionStep).save(flow.step);
    await manager.getRepository(NodiaAiExecution).save(flow.execution);
    await manager.getRepository(NodiaAiJob).save(flow.job);
    await manager.getRepository(NodiaAiExecutionGrant).save(flow.grant);
    await manager.query(
      'UPDATE nodia_ai_conversations SET active_job_id=NULL WHERE id=$1 AND active_job_id=$2',
      [flow.loaded.chat.id, flow.job.id],
    );
    await appendNodiaAiExecutionEvent(manager, {
      conversationId: flow.loaded.chat.id,
      executionId: flow.execution.id,
      eventKey: `execution:${flow.execution.id}:${flow.execution.revision}:${flow.execution.state}`,
      payload: {
        revision: flow.execution.revision,
        state: flow.execution.state,
        error: null,
      },
      moduleRoutes: flow.grant.allowed_modules,
      maxEvents: this.policy.results.outbox_events_per_activity,
    });
  }
  private async markUnknown(
    id: string,
    reference: string,
    requestId: string,
    error: unknown,
    observedReference?: NodiaAiJsonObject,
  ) {
    await this.store.transaction(async (manager) => {
      await lockAuthority(
        manager,
        false,
        this.policy.timing.read_query_seconds * 1000,
      );
      await lockNodiaAiQueue(manager);
      const initial = await this.store.execution(manager, id);
      if (!initial) return;
      if (initial.conversation_id)
        await this.store.chat(manager, initial.conversation_id);
      const jobs = await this.store.jobs(manager, id),
        execution = await this.store.execution(manager, id, true),
        steps = await this.store.steps(manager, id),
        step = steps[0],
        job = jobs[0];
      if (!execution || !step || !job || step.state === 'completed') return;
      const descriptor = secureDescriptor(step.recovery_descriptor);
      if (
        descriptor.reference !== reference ||
        descriptor.request_id !== requestId
      )
        return;
      // A durable request may already own a native admission witness despite a busy response.
      // Keep it observable/cancellable; only an unarmed local wait may be started again.
      const busy =
        error instanceof HttpException &&
        error.getStatus() === 409 &&
        /runtime_busy|profile_busy/.test(error.message);
      descriptor.status = busy
        ? descriptor.native_reference
          ? 'pending'
          : descriptor.native_request
            ? 'unknown'
            : 'waiting'
        : 'unknown';
      if (observedReference && !busy) {
        descriptor.native_reference = observedReference;
        secureDescriptor(descriptor);
      }
      step.recovery_descriptor = descriptor;
      execution.state = 'waiting_for_user';
      execution.revision++;
      await manager.getRepository(NodiaAiExecutionStep).save(step);
      await manager.getRepository(NodiaAiExecution).save(execution);
    });
  }
}
