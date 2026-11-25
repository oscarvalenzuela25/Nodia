import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type { AiSelection } from '../ai-generation/ai-selection.js';
import {
  ApiNodiaAiCredentialsService,
  type NodiaAiApiConfiguration,
} from '../nodia-ai-adapter/api-nodia-ai-credentials.service.js';
import { NodiaAiAdapterError } from '../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import { NodiaAiConnectionsService } from '../nodia-ai-conversation/nodia-ai-connections.service.js';
import {
  NODIA_AI_CONNECTION_PAGE_UTF8_BYTES,
  projectNodiaAiConnection,
} from '../nodia-ai-conversation/use-case/list-nodia-ai-connections.use-case.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../nodia-ai-runtime/config/runtime-policy.js';
import { NodiaCvCodexSelection } from './agentic/nodia-cv-codex-selection.js';
import { NodiaCvCodexTransport } from './agentic/nodia-cv-codex-transport.js';
import {
  CV_TAILORING_PROMPT_VERSION,
  CV_TAILORING_PURPOSE,
  CV_TAILORING_SCHEMA_VERSION,
} from './engine/types.js';
import type {
  CvAgenticConfiguration,
  CvGenerationConfiguration,
} from './types/nodia-cv-generation.types.js';

export type CvAgenticObservation = Awaited<
  ReturnType<NodiaCvCodexTransport['observe']>
> | null;

type CvEligibilityCode =
  | 'agentic_transport_unavailable'
  | 'configuration_unavailable'
  | 'qualification_required'
  | 'qualified';

export interface CvSelectionEligibility {
  selection: AiSelection;
  configured: boolean | null;
  qualified: boolean;
  eligible: boolean;
  reason_code: CvEligibilityCode;
  checked_at: Date | null;
}

@Injectable()
export class NodiaCvSelectionService {
  constructor(
    private readonly credentials: ApiNodiaAiCredentialsService,
    private readonly connections: NodiaAiConnectionsService,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
    @Optional() private readonly codex?: NodiaCvCodexTransport,
    @Optional() private readonly codexSelection?: NodiaCvCodexSelection,
  ) {}

  /** Native inspection runs outside the authority and queue transactions. */
  async observeAgentic(
    selection: AiSelection,
    signal: AbortSignal,
  ): Promise<CvAgenticObservation> {
    if (selection.mode !== 'agentic' || !this.codexSelection || !this.codex)
      return null;
    return this.codex.observe(selection, signal);
  }

  async configureAgentic(
    selection: AiSelection,
    manager: EntityManager,
    observation: CvAgenticObservation,
  ): Promise<CvAgenticConfiguration> {
    if (
      !this.codexSelection ||
      !observation ||
      observation.transport.status === 'host_unavailable' ||
      observation.selection.status === 'codex_runtime_unavailable'
    ) {
      throw new ServiceUnavailableException(
        'nodiaCv:agentic_transport_unavailable',
      );
    }
    const { selection: verified, transport } = observation;
    if (
      selection.mode !== 'agentic' ||
      verified.status !== 'metadata_ready' ||
      transport.status !== 'available' ||
      verified.selection.connection_id !== selection.connection_id ||
      verified.selection.model_id !== selection.model_id ||
      verified.selection.effort_id !== selection.effort_id ||
      !(await this.codexSelection.matchesConfiguration(manager, verified))
    ) {
      throw new UnprocessableEntityException(
        'nodiaCv:configuration_unavailable',
      );
    }
    return {
      providerKey: verified.providerKey,
      connectionId: verified.selection.connection_id,
      keyId: null,
      configurationGeneration: verified.configurationGeneration,
      sessionGeneration: verified.sessionGeneration,
      resourceKey: verified.resourceKey,
      policyHash: transport.policyHash,
      runtimeHash: transport.runtimeHash,
    };
  }

  async configure(
    selection: AiSelection,
    manager: EntityManager,
  ): Promise<NodiaAiApiConfiguration> {
    if (selection.mode === 'agentic')
      throw new ServiceUnavailableException(
        'nodiaCv:agentic_transport_unavailable',
      );

    try {
      return await this.credentials.configuration(selection, manager);
    } catch (error) {
      if (error instanceof NodiaAiAdapterError)
        throw new UnprocessableEntityException(
          'nodiaCv:configuration_unavailable',
        );
      throw error;
    }
  }

  scopeHash(selection: AiSelection, config: CvGenerationConfiguration): string {
    const transportIdentity =
      config.keyId === null ? [config.policyHash, config.runtimeHash] : [];
    return createHash('sha256')
      .update(
        JSON.stringify([
          CV_TAILORING_PURPOSE,
          CV_TAILORING_PROMPT_VERSION,
          CV_TAILORING_SCHEMA_VERSION,
          this.policy.policyHash,
          selection.connection_id,
          selection.mode,
          selection.model_id,
          selection.effort_id,
          config.providerKey,
          config.connectionId,
          config.keyId,
          config.configurationGeneration,
          config.sessionGeneration,
          config.resourceKey,
          ...transportIdentity,
        ]),
      )
      .digest('hex');
  }

  private async qualification(
    manager: EntityManager,
    scopeHash: string,
  ): Promise<Date | null> {
    const [row]: { checked_at: Date }[] = await manager.query(
      `SELECT q.checked_at
       FROM nodia_cv_generation_qualifications q
       JOIN nodia_cv_generations g ON g.id=q.generation_id AND g.qualification
       JOIN ai_generation_operations o ON o.cv_generation_id=g.id AND o.actor_id=g.owner_user_id
       WHERE q.scope_hash=$1 AND g.scope_hash=q.scope_hash AND o.owner_kind='cv'
         AND o.phase='closed' AND o.remote_outcome='completed' AND o.acknowledged_at IS NOT NULL
         AND o.response_hash=q.response_hash
         AND (
           o.selection_snapshot->>'mode'='api_key'
           OR (o.selection_snapshot->>'mode'='agentic' AND o.agentic_transport_descriptor IS NOT NULL
             AND o.agentic_acknowledged_at IS NOT NULL)
         )`,
      [scopeHash],
    );
    return row?.checked_at ?? null;
  }

  async qualified(manager: EntityManager, scopeHash: string): Promise<boolean> {
    return (await this.qualification(manager, scopeHash)) !== null;
  }

  async eligibility(
    manager: EntityManager,
    selection: AiSelection,
    observation: CvAgenticObservation = null,
  ): Promise<CvSelectionEligibility> {
    const requested = {
      connection_id: selection.connection_id,
      mode: selection.mode,
      model_id: selection.model_id,
      effort_id: selection.effort_id,
    };
    let config: CvGenerationConfiguration;
    try {
      config =
        requested.mode === 'agentic'
          ? await this.configureAgentic(requested, manager, observation)
          : await this.configure(requested, manager);
    } catch (error) {
      const unavailable =
        requested.mode === 'agentic' &&
        error instanceof ServiceUnavailableException;
      if (!unavailable && !(error instanceof UnprocessableEntityException))
        throw error;
      return {
        selection: requested,
        configured: unavailable ? null : false,
        qualified: false,
        eligible: false,
        reason_code: unavailable
          ? 'agentic_transport_unavailable'
          : 'configuration_unavailable',
        checked_at: null,
      };
    }

    const checkedAt = await this.qualification(
      manager,
      this.scopeHash(requested, config),
    );
    return {
      selection: requested,
      configured: true,
      qualified: checkedAt !== null,
      eligible: checkedAt !== null,
      reason_code: checkedAt === null ? 'qualification_required' : 'qualified',
      checked_at: checkedAt,
    };
  }

  async catalog(manager: EntityManager, after?: string) {
    if (
      after !== undefined &&
      (!/^[1-9][0-9]{0,18}$/.test(after) ||
        BigInt(after) > 9223372036854775807n)
    ) {
      throw new BadRequestException('nodiaCv:invalid_cursor');
    }
    const limit = this.policy.results.list_default_rows;
    const rows = await this.connections.list(manager, after ?? null, limit);
    const items = [];
    // Reserve response envelope overhead and preserve whole connections when paginating.
    let bytes = 4096;
    for (const row of rows.slice(0, limit)) {
      const connection = projectNodiaAiConnection(row);
      const item = {
        ...connection,
        modes: connection.modes.map((mode) => ({
          ...mode,
          cv_transport:
            mode.mode === 'api_key' &&
            ['gemini', 'openai'].includes(row.provider_key)
              ? ('available' as const)
              : ('unsupported' as const),
        })),
      };
      const itemBytes = Buffer.byteLength(JSON.stringify(item), 'utf8') + 1;
      if (bytes + itemBytes > NODIA_AI_CONNECTION_PAGE_UTF8_BYTES) {
        if (items.length === 0)
          throw new ServiceUnavailableException(
            'nodiaCv:connection_catalog_too_large',
          );
        break;
      }
      items.push(item);
      bytes += itemBytes;
    }
    return {
      items,
      next_cursor:
        rows.length > items.length
          ? (items.at(-1)?.connection_id ?? null)
          : null,
    };
  }
}
