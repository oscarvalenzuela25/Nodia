import {
  BadRequestException,
  Inject,
  Injectable,
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
import {
  CV_TAILORING_PROMPT_VERSION,
  CV_TAILORING_PURPOSE,
  CV_TAILORING_SCHEMA_VERSION,
} from './engine/types.js';

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
  ) {}

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

  scopeHash(selection: AiSelection, config: NodiaAiApiConfiguration): string {
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
         AND o.response_hash=q.response_hash`,
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
  ): Promise<CvSelectionEligibility> {
    const requested = {
      connection_id: selection.connection_id,
      mode: selection.mode,
      model_id: selection.model_id,
      effort_id: selection.effort_id,
    };
    if (requested.mode === 'agentic') {
      return {
        selection: requested,
        configured: null,
        qualified: false,
        eligible: false,
        reason_code: 'agentic_transport_unavailable',
        checked_at: null,
      };
    }

    let config: NodiaAiApiConfiguration;
    try {
      config = await this.configure(requested, manager);
    } catch (error) {
      if (!(error instanceof UnprocessableEntityException)) throw error;
      return {
        selection: requested,
        configured: false,
        qualified: false,
        eligible: false,
        reason_code: 'configuration_unavailable',
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
