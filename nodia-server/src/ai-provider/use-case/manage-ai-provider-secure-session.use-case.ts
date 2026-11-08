import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { validateCatalogId } from '../../common/dto/catalog-id.dto.js';
import { AiProvider } from '../entities/ai-provider.entity.js';
import { resolveAiProviderUpdate } from './ai-provider-configuration.rules.js';
import { runAiProviderConfigurationTransaction } from './ai-provider-configuration-transaction.js';
import { GeminiService } from '../../common/ai/gemini.service.js';
import { ManageGeminiAgenticLoginUseCase } from './manage-gemini-agentic-login.use-case.js';
import { ManageCodexSessionUseCase } from './manage-codex-session.use-case.js';
import {
  SyncAiProviderModelsUseCase,
  type DiscoveredModelInfo,
} from './sync-ai-provider-models.use-case.js';
export type AiProviderSecureMode = 'api_key' | 'agentic';
export interface AiProviderSecureReference {
  provider_id: string;
  provider_key: 'gemini' | 'openai';
  mode: AiProviderSecureMode;
  job_id: string;
}
export interface AiProviderSecureRequest {
  provider_id: string;
  provider_key: 'gemini' | 'openai';
  mode: 'agentic';
  request_id: string;
}
export interface AiProviderSecureObservation {
  reference: AiProviderSecureReference;
  state: 'pending' | 'completed' | 'failed' | 'cancelled' | 'expired';
  /** Human transport only. Never store or return this data to a language model. */
  human: {
    kind: 'gemini_agentic' | 'codex';
    data: unknown;
  };
}
/** Native profiles own admission and lifetime. This bridge never acquires a second runtime slot. */
@Injectable()
export class ManageAiProviderSecureSessionUseCase {
  constructor(
    private readonly source: DataSource,
    private readonly agentic: ManageGeminiAgenticLoginUseCase,
    private readonly codex: ManageCodexSessionUseCase,
    private readonly sync: SyncAiProviderModelsUseCase,
    private readonly gemini: GeminiService,
  ) {}
  async authorize(
    manager: EntityManager,
    actor: ActorReference,
    providerId: string,
    mode: AiProviderSecureMode,
    requireEnabled = true,
  ) {
    validateCatalogId(providerId, 'ai_provider:invalid_id');
    if (!['api_key', 'agentic'].includes(mode))
      throw new BadRequestException('ai_provider:invalid_mode');
    return runAiProviderConfigurationTransaction(
      this.source,
      { ...actor, transaction: manager },
      async (tx) => {
        const provider = await tx
          .getRepository(AiProvider)
          .findOne({ where: { id: providerId }, relations: { catalog: true } });
        if (!provider) throw new NotFoundException('ai_provider:not_found');
        if (
          requireEnabled &&
          (!provider.is_active ||
            !provider.catalog?.is_active ||
            provider[`use_${mode}`] !== true ||
            provider.catalog[`can_use_${mode}`] !== true)
        )
          throw new ConflictException('ai_provider:channel_disabled');
        const key = provider.catalog?.key;
        if (typeof key !== 'string' || !['gemini', 'openai'].includes(key))
          throw new BadRequestException('ai_provider:session_unsupported');
        return { id: provider.id, key: key as 'gemini' | 'openai', mode };
      },
    );
  }
  private async outsideTransaction(
    actor: ActorReference,
    providerId: string,
    mode: AiProviderSecureMode,
    requireEnabled = true,
  ) {
    if (actor.transaction)
      throw new ConflictException('ai_provider:external_transaction_forbidden');
    return runAiProviderConfigurationTransaction(
      this.source,
      actor,
      (manager) =>
        this.authorize(manager, actor, providerId, mode, requireEnabled),
    );
  }
  private async reference(
    ref: AiProviderSecureReference,
    actor: ActorReference,
    requireEnabled = false,
  ) {
    const target = await this.outsideTransaction(
      actor,
      ref.provider_id,
      ref.mode,
      requireEnabled,
    );
    if (
      target.key !== ref.provider_key ||
      ref.mode === 'api_key' ||
      !(
        target.key === 'openai'
          ? /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
          : /^[0-9a-f]{32}$/
      ).test(ref.job_id)
    )
      throw new BadRequestException('ai_provider:invalid_login_reference');
    return target;
  }
  private observation(
    reference: AiProviderSecureReference,
    data: unknown,
  ): AiProviderSecureObservation {
    if (
      !data ||
      typeof data !== 'object' ||
      !('state' in data) ||
      !('id' in data) ||
      data.id !== reference.job_id
    )
      throw new BadRequestException('ai_provider:invalid_login_observation');
    const state = data.state;
    if (
      ![
        'running',
        'waiting_code',
        'waiting_authorization',
        'verifying',
        'succeeded',
        'failed',
        'cancelled',
      ].includes(String(state))
    )
      throw new BadRequestException('ai_provider:invalid_login_observation');
    return {
      reference,
      state:
        state === 'succeeded'
          ? 'completed'
          : state === 'failed'
            ? 'failed'
            : state === 'cancelled'
              ? 'cancelled'
              : 'pending',
      human: {
        kind: reference.provider_key === 'openai' ? 'codex' : 'gemini_agentic',
        data,
      },
    };
  }
  async start(
    providerId: string,
    mode: AiProviderSecureMode,
    actor: ActorReference,
    requestId?: string,
    expiresAt?: string,
  ): Promise<AiProviderSecureObservation> {
    const target = await this.outsideTransaction(actor, providerId, mode);
    if (mode === 'api_key')
      throw new BadRequestException('ai_provider:session_unsupported');
    if (
      requestId !== undefined &&
      !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(requestId)
    )
      throw new BadRequestException('ai_provider:invalid_request_id');
    if (
      requestId &&
      (typeof expiresAt !== 'string' ||
        !Number.isFinite(Date.parse(expiresAt)) ||
        Date.parse(expiresAt) <= Date.now() ||
        Date.parse(expiresAt) > Date.now() + 300000)
    )
      throw new BadRequestException('ai_provider:invalid_login_deadline');
    const data =
      target.key === 'openai'
        ? requestId
          ? await this.codex.start(
              providerId,
              actor.userId,
              requestId,
              expiresAt,
            )
          : await this.codex.start(providerId, actor.userId)
        : requestId
          ? await this.gemini.durableLoginRequest(
              'agentic',
              'start',
              requestId,
              providerId,
              actor.userId,
              expiresAt,
            )
          : await this.agentic.start(actor.userId);
    if (
      !data ||
      typeof data !== 'object' ||
      !('id' in data) ||
      typeof data.id !== 'string' ||
      (requestId !== undefined &&
        data.id !==
          (target.key === 'openai'
            ? requestId.toLowerCase()
            : requestId.toLowerCase().replaceAll('-', '')))
    )
      throw new BadRequestException('ai_provider:invalid_login_observation');
    return this.observation(
      {
        provider_id: providerId,
        provider_key: target.key,
        mode,
        job_id: data.id,
      },
      data,
    );
  }
  private validateRequest(
    target: AiProviderSecureRequest,
    actorUserId: string,
  ) {
    validateCatalogId(actorUserId, 'ai_provider:invalid_actor');
    validateCatalogId(target.provider_id, 'ai_provider:invalid_id');
    if (
      Object.keys(target).sort().join(',') !==
        'mode,provider_id,provider_key,request_id' ||
      !['gemini', 'openai'].includes(target.provider_key) ||
      !['agentic'].includes(target.mode) ||
      (target.provider_key === 'openai' && target.mode !== 'agentic') ||
      !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(target.request_id)
    )
      throw new BadRequestException('ai_provider:invalid_login_request');
  }
  /** Trusted lifecycle observation of a previously armed request; never authorizes a new login. */
  async observeRequest(
    target: AiProviderSecureRequest,
    actorUserId: string,
  ): Promise<AiProviderSecureObservation | null> {
    return this.requestObservation(target, actorUserId, false);
  }
  /** Cancellation fences delayed start, even when its initial response was lost. */
  async cancelRequest(
    target: AiProviderSecureRequest,
    actorUserId: string,
  ): Promise<AiProviderSecureObservation> {
    return this.requestObservation(target, actorUserId, true);
  }
  /** Post-commit acknowledgement only: the native proof remains until SQL has settled. */
  async acknowledgeRequest(
    target: AiProviderSecureRequest,
    actorUserId: string,
  ): Promise<void> {
    this.validateRequest(target, actorUserId);
    if (target.provider_key === 'openai') {
      await this.codex.acknowledgeRequest(
        target.provider_id,
        target.request_id.toLowerCase(),
        actorUserId,
      );
      return;
    }
    await this.gemini.acknowledgeLoginRequest(
      'agentic',
      target.request_id,
      target.provider_id,
      actorUserId,
    );
  }
  private async requestObservation(
    target: AiProviderSecureRequest,
    actorUserId: string,
    cancel: boolean,
  ): Promise<AiProviderSecureObservation> {
    this.validateRequest(target, actorUserId);
    const requestId = target.request_id.toLowerCase();
    const data =
      target.provider_key === 'openai'
        ? cancel
          ? await this.codex.cancelRequest(
              target.provider_id,
              requestId,
              actorUserId,
            )
          : await this.codex.statusRequest(
              target.provider_id,
              requestId,
              actorUserId,
            )
        : await this.gemini.durableLoginRequest(
            'agentic',
            cancel ? 'cancel' : 'status',
            requestId,
            target.provider_id,
            actorUserId,
          );
    return this.observation(
      {
        provider_id: target.provider_id,
        provider_key: target.provider_key,
        mode: target.mode,
        job_id:
          target.provider_key === 'openai'
            ? requestId
            : requestId.replaceAll('-', ''),
      },
      data,
    );
  }
  async status(
    ref: AiProviderSecureReference,
    actor: ActorReference,
  ): Promise<AiProviderSecureObservation> {
    await this.reference(ref, actor);
    const data =
      ref.provider_key === 'openai'
        ? await this.codex.status(ref.provider_id, ref.job_id, actor.userId)
        : await this.agentic.status(ref.job_id, actor.userId);
    return this.observation(ref, data);
  }
  async cancel(
    ref: AiProviderSecureReference,
    actor: ActorReference,
  ): Promise<AiProviderSecureObservation> {
    await this.reference(ref, actor);
    const data =
      ref.provider_key === 'openai'
        ? await this.codex.cancel(ref.provider_id, ref.job_id, actor.userId)
        : await this.agentic.cancel(ref.job_id, actor.userId);
    return this.observation(ref, data);
  }
  /** Trusted lifecycle cleanup only. This releases an already owned native job after authority expires; it cannot start login or log out an account. */
  async cleanup(
    ref: AiProviderSecureReference,
    actorUserId: string,
  ): Promise<AiProviderSecureObservation> {
    validateCatalogId(actorUserId, 'ai_provider:invalid_actor');
    validateCatalogId(ref.provider_id, 'ai_provider:invalid_id');
    if (
      Object.keys(ref).sort().join(',') !==
        'job_id,mode,provider_id,provider_key' ||
      !['gemini', 'openai'].includes(ref.provider_key) ||
      !['agentic'].includes(ref.mode) ||
      (ref.provider_key === 'openai' && ref.mode !== 'agentic') ||
      !(
        ref.provider_key === 'openai'
          ? /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
          : /^[0-9a-f]{32}$/
      ).test(ref.job_id)
    )
      throw new BadRequestException('ai_provider:invalid_login_reference');
    const data =
      ref.provider_key === 'openai'
        ? await this.codex.cancel(ref.provider_id, ref.job_id, actorUserId)
        : await this.agentic.cancel(ref.job_id, actorUserId);
    return this.observation(ref, data);
  }
  async submitCode(
    ref: AiProviderSecureReference,
    code: string,
    actor: ActorReference,
  ): Promise<AiProviderSecureObservation> {
    await this.reference(ref, actor, true);
    if (ref.provider_key !== 'gemini' || ref.mode !== 'agentic')
      throw new BadRequestException('ai_provider:code_unsupported');
    return this.observation(
      ref,
      await this.agentic.submit(ref.job_id, actor.userId, { code }),
    );
  }
  async logout(
    providerId: string,
    mode: AiProviderSecureMode,
    actor: ActorReference,
  ): Promise<{
    disconnected: true;
  }> {
    const target = await this.outsideTransaction(
      actor,
      providerId,
      mode,
      false,
    );
    if (target.key === 'openai' && mode === 'agentic') {
      const result = await this.codex.logout(providerId);
      if (result.disconnected !== true)
        throw new ConflictException('ai_provider:logout_unconfirmed');
      return { disconnected: true };
    }
    throw new BadRequestException('ai_provider:logout_unsupported');
  }
  async discover(
    providerId: string,
    mode: AiProviderSecureMode,
    actor: ActorReference,
  ) {
    await this.outsideTransaction(actor, providerId, mode);
    return this.sync.execute(providerId, { mode, persist: false });
  }
  async commitDiscovery(
    manager: EntityManager,
    actor: ActorReference,
    providerId: string,
    mode: AiProviderSecureMode,
    models: readonly DiscoveredModelInfo[],
  ): Promise<void> {
    if (
      !Array.isArray(models) ||
      models.length < 1 ||
      models.length > 1000 ||
      models.some(
        (m) =>
          !m || typeof m.id !== 'string' || !m.id.trim() || m.id.length > 512,
      )
    )
      throw new BadRequestException('ai_provider:invalid_models');
    await this.authorize(manager, actor, providerId, mode);
    const repo = manager.getRepository(AiProvider);
    const current = await repo.findOneOrFail({
      where: { id: providerId },
      relations: { catalog: true },
    });
    const resolved = resolveAiProviderUpdate(
      { fields: { [mode]: { available_models: models } } },
      current,
      current.catalog ?? null,
    );
    await repo.update(providerId, { fields: resolved.fields });
  }
}
