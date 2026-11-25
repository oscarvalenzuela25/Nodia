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
import { agenticHash } from '../ai-generation/agentic-text-contract.js';
import type { AiSelection } from '../ai-generation/ai-selection.js';
import {
  isAgenticModelAllowed,
  restrictAgenticModelFields,
} from '../ai-provider/helpers/agentic-model-policy.helper.js';
import { isGeminiAgenticEffort } from '../common/ai/agentic-reasoning.js';
import {
  ApiNodiaAiCredentialsService,
  type NodiaAiApiConfiguration,
} from '../nodia-ai-adapter/api-nodia-ai-credentials.service.js';
import { NodiaAiAdapterError } from '../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import {
  NodiaAiConnectionsService,
  type NodiaAiConnectionConfiguration,
} from '../nodia-ai-conversation/nodia-ai-connections.service.js';
import {
  configurationRecord,
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
  NodiaCvGeminiTransport,
  type CvGeminiObservation,
} from './agentic/nodia-cv-gemini-transport.js';
import {
  CV_TAILORING_PROMPT_VERSION,
  CV_TAILORING_PURPOSE,
  CV_TAILORING_SCHEMA_VERSION,
} from './engine/types.js';
import type {
  CvAgenticConfiguration,
  CvGenerationConfiguration,
} from './types/nodia-cv-generation.types.js';

type CvCodexObservation = Awaited<ReturnType<NodiaCvCodexTransport['observe']>>;

type CvGeminiBlockedReason =
  | 'gemini_runtime_unavailable'
  | 'gemini_session_required'
  | 'gemini_session_unverified'
  | 'gemini_model_unavailable'
  | 'gemini_effort_unavailable'
  | 'gemini_profile_busy'
  | 'configuration_unavailable';

type CvGeminiAgenticObservation = {
  provider: 'gemini';
  requested: AiSelection;
  configurationGeneration: string | null;
  native: CvGeminiObservation | null;
  blockedReason: CvGeminiBlockedReason | null;
};

export type CvAgenticObservation =
  CvCodexObservation | CvGeminiAgenticObservation | null;

type CvEligibilityCode =
  | 'agentic_transport_unavailable'
  | 'codex_runtime_unavailable'
  | 'codex_session_required'
  | 'codex_session_unverified'
  | 'codex_model_unavailable'
  | 'codex_effort_unavailable'
  | 'codex_profile_busy'
  | 'codex_usage_unavailable'
  | CvGeminiBlockedReason
  | 'qualification_required'
  | 'qualified';

type CvGeminiQualification = {
  scope_hash: string;
  connection_id: string;
  model_id: string;
  effort_id: string | null;
  configuration_generation: string;
  session_generation: string;
  resource_key: string;
  policy_hash: string;
  runtime_hash: string;
};

type CvGeminiChoices = Map<string, Map<string, Set<string | null>>>;

export interface CvSelectionEligibility {
  selection: AiSelection;
  configured: boolean | null;
  qualified: boolean;
  eligible: boolean;
  reason_code: CvEligibilityCode;
  checked_at: Date | null;
}

function agenticBlockReason(
  observation: CvAgenticObservation,
): CvEligibilityCode {
  if (!observation) return 'agentic_transport_unavailable';
  if ('provider' in observation)
    return observation.blockedReason ?? 'configuration_unavailable';
  if (observation.transport.status === 'host_unavailable')
    return 'agentic_transport_unavailable';
  if (observation.transport.status === 'selection_unsupported')
    return observation.transport.reason === 'codex_effort_unavailable'
      ? 'codex_effort_unavailable'
      : 'codex_model_unavailable';
  switch (observation.selection.status) {
    case 'codex_session_required':
    case 'codex_session_unverified':
    case 'codex_effort_unavailable':
    case 'codex_profile_busy':
    case 'codex_usage_unavailable':
      return observation.selection.status;
    case 'codex_model_not_allowed':
    case 'codex_model_unavailable':
      return 'codex_model_unavailable';
    case 'codex_protocol_invalid':
    case 'codex_timeout':
    case 'codex_runtime_unavailable':
      return 'codex_runtime_unavailable';
    default:
      return 'configuration_unavailable';
  }
}

export function cvAgenticObservationBusy(observation: CvAgenticObservation) {
  const reason = agenticBlockReason(observation);
  return reason === 'codex_profile_busy' || reason === 'gemini_profile_busy';
}

function validConnectionId(id: string) {
  return /^[1-9][0-9]{0,18}$/.test(id) && BigInt(id) <= 9223372036854775807n;
}

function geminiConfiguration(row: NodiaAiConnectionConfiguration) {
  if (
    row.provider_key !== 'gemini' ||
    !row.is_active ||
    !row.catalog_active ||
    !row.use_agentic ||
    !row.can_use_agentic ||
    !row.configuration_updated_at
  )
    return null;
  const updatedAt = new Date(row.configuration_updated_at);
  const rawFields = configurationRecord(row.fields).agentic;
  const fields = configurationRecord(rawFields);
  if (!Number.isFinite(updatedAt.getTime())) return null;
  return {
    fields,
    configurationGeneration: agenticHash({
      connection_id: row.id,
      provider_key: row.provider_key,
      mode: 'agentic',
      fields: rawFields ?? null,
      updated_at: updatedAt,
      enabled: true,
    }),
  };
}

function geminiSavedSelection(
  row: NodiaAiConnectionConfiguration,
  selection: AiSelection,
) {
  const config = geminiConfiguration(row);
  if (!config || selection.connection_id !== row.id)
    return { reason: 'configuration_unavailable' } as const;
  const { fields } = config;
  if (
    !isAgenticModelAllowed(fields, selection.model_id) ||
    (fields.selected_model !== selection.model_id &&
      !(
        Array.isArray(fields.available_models) &&
        fields.available_models.some(
          (model) => configurationRecord(model).id === selection.model_id,
        )
      ))
  )
    return { reason: 'gemini_model_unavailable' } as const;
  if (
    selection.effort_id !== null &&
    !isGeminiAgenticEffort(selection.effort_id, selection.model_id)
  )
    return { reason: 'gemini_effort_unavailable' } as const;
  return { configurationGeneration: config.configurationGeneration };
}

function geminiBlockReason(reason: string | null): CvGeminiBlockedReason {
  switch (reason) {
    case 'runtime_busy':
      return 'gemini_profile_busy';
    case 'session_required':
    case 'teacher_sdk_session_required':
      return 'gemini_session_required';
    case 'teacher_sdk_session_unverified':
      return 'gemini_session_unverified';
    case 'model_unavailable':
      return 'gemini_model_unavailable';
    case 'model_option_mismatch':
    case 'thinking_level_unsupported':
      return 'gemini_effort_unavailable';
    default:
      return 'gemini_runtime_unavailable';
  }
}

const CV_QUALIFICATION_JOIN = `FROM nodia_cv_generation_qualifications q
       JOIN nodia_cv_generations g ON g.id=q.generation_id AND g.qualification
       JOIN ai_generation_operations o ON o.cv_generation_id=g.id AND o.actor_id=g.owner_user_id`;

const CV_QUALIFICATION_PROOF = `g.scope_hash=q.scope_hash AND o.owner_kind='cv'
         AND o.phase='closed' AND o.remote_outcome='completed' AND o.acknowledged_at IS NOT NULL
         AND o.response_hash=q.response_hash`;

@Injectable()
export class NodiaCvSelectionService {
  constructor(
    private readonly credentials: ApiNodiaAiCredentialsService,
    private readonly connections: NodiaAiConnectionsService,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
    @Optional() private readonly codex?: NodiaCvCodexTransport,
    @Optional() private readonly codexSelection?: NodiaCvCodexSelection,
    @Optional() private readonly gemini?: NodiaCvGeminiTransport,
  ) {}

  /** Native inspection runs outside the authority and queue transactions. */
  async observeAgentic(
    selection: AiSelection,
    signal: AbortSignal,
  ): Promise<CvAgenticObservation> {
    if (
      selection.mode !== 'agentic' ||
      !validConnectionId(selection.connection_id)
    )
      return null;
    signal.throwIfAborted();
    if (this.gemini) {
      const row = await this.connections.transaction((manager) =>
        this.connections.find(manager, selection.connection_id),
      );
      signal.throwIfAborted();
      if (row?.provider_key === 'gemini')
        return this.observeGemini(this.gemini, row, selection, signal);
      if (row?.provider_key !== 'openai') return null;
    }
    return this.codex && this.codexSelection
      ? this.codex.observe(selection, signal)
      : null;
  }

  private async observeGemini(
    gemini: NodiaCvGeminiTransport,
    row: NodiaAiConnectionConfiguration,
    selection: AiSelection,
    signal: AbortSignal,
  ): Promise<CvGeminiAgenticObservation> {
    const requested: AiSelection = {
      connection_id: selection.connection_id,
      mode: 'agentic',
      model_id: selection.model_id,
      effort_id: selection.effort_id,
    };
    const config = geminiSavedSelection(row, requested);
    const rejected = (
      blockedReason: CvGeminiBlockedReason,
    ): CvGeminiAgenticObservation => ({
      provider: 'gemini',
      requested,
      configurationGeneration: null,
      native: null,
      blockedReason,
    });
    if (config.reason) return rejected(config.reason);

    let native: CvGeminiObservation;
    try {
      native = await gemini.observe(
        requested,
        config.configurationGeneration,
        AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
      );
    } catch (error) {
      signal.throwIfAborted();
      return rejected(
        geminiBlockReason(
          error instanceof NodiaAiAdapterError ? error.code : null,
        ),
      );
    }
    signal.throwIfAborted();
    return {
      provider: 'gemini',
      requested,
      configurationGeneration: config.configurationGeneration,
      native,
      blockedReason: native.available ? null : geminiBlockReason(native.reason),
    };
  }

  private async configureGemini(
    selection: AiSelection,
    manager: EntityManager,
    observation: CvGeminiAgenticObservation,
  ): Promise<CvAgenticConfiguration> {
    const { native, requested, blockedReason, configurationGeneration } =
      observation;
    if (blockedReason === 'gemini_runtime_unavailable')
      throw new ServiceUnavailableException(
        'nodiaCv:agentic_transport_unavailable',
      );
    if (
      !this.gemini ||
      selection.mode !== 'agentic' ||
      !configurationGeneration ||
      blockedReason !== null ||
      !native?.available ||
      !native.resourceKey ||
      !native.binarySha512 ||
      requested.connection_id !== selection.connection_id ||
      requested.model_id !== selection.model_id ||
      requested.effort_id !== selection.effort_id
    )
      throw new UnprocessableEntityException(
        'nodiaCv:configuration_unavailable',
      );
    const row = await this.connections.find(manager, selection.connection_id);
    if (
      !row ||
      geminiSavedSelection(row, selection).configurationGeneration !==
        configurationGeneration
    )
      throw new UnprocessableEntityException(
        'nodiaCv:configuration_unavailable',
      );
    return {
      providerKey: 'gemini',
      connectionId: selection.connection_id,
      keyId: null,
      configurationGeneration,
      sessionGeneration: native.sessionGeneration,
      resourceKey: native.resourceKey,
      policyHash: native.policyHash,
      runtimeHash: native.runtimeHash,
    };
  }

  async configureAgentic(
    selection: AiSelection,
    manager: EntityManager,
    observation: CvAgenticObservation,
  ): Promise<CvAgenticConfiguration> {
    if (observation && 'provider' in observation)
      return this.configureGemini(selection, manager, observation);
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
       ${CV_QUALIFICATION_JOIN}
       WHERE q.scope_hash=$1 AND ${CV_QUALIFICATION_PROOF}
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
      const reason =
        requested.mode === 'agentic'
          ? agenticBlockReason(observation)
          : 'configuration_unavailable';
      return {
        selection: requested,
        configured:
          reason === 'configuration_unavailable' ||
          reason === 'codex_model_unavailable' ||
          reason === 'codex_effort_unavailable' ||
          reason === 'gemini_model_unavailable' ||
          reason === 'gemini_effort_unavailable'
            ? false
            : null,
        qualified: false,
        eligible: false,
        reason_code: reason,
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

  private async geminiQualifications(
    manager: EntityManager,
    connections: NodiaAiConnectionConfiguration[],
  ): Promise<CvGeminiChoices> {
    const current = connections.flatMap((row) => {
      const config = geminiConfiguration(row);
      return config
        ? [
            {
              connection_id: row.id,
              configuration_generation: config.configurationGeneration,
            },
          ]
        : [];
    });
    const choices: CvGeminiChoices = new Map();
    if (!this.gemini || current.length === 0) return choices;

    // One lookup per catalog page. Each choice uses its most recent receipt for this saved configuration.
    const receipts = await manager.query<CvGeminiQualification[]>(
      `SELECT DISTINCT ON (o.connection_id, o.selection_snapshot->>'model_id', o.selection_snapshot->>'effort_id')
         q.scope_hash, o.connection_id::text, o.selection_snapshot->>'model_id' AS model_id,
         o.selection_snapshot->>'effort_id' AS effort_id, o.configuration_generation,
         o.session_generation, o.resource_key, o.agentic_transport_descriptor->>'policy_hash' AS policy_hash,
         o.agentic_transport_descriptor->>'runtime_hash' AS runtime_hash
       ${CV_QUALIFICATION_JOIN}
       JOIN jsonb_to_recordset($1::jsonb) AS configs(connection_id bigint, configuration_generation text)
         ON configs.connection_id=o.connection_id AND configs.configuration_generation=o.configuration_generation
       WHERE ${CV_QUALIFICATION_PROOF}
         AND o.selection_snapshot->>'mode'='agentic' AND o.agentic_transport_descriptor->>'provider'='gemini'
         AND o.started_exchanges=1 AND o.agentic_acknowledged_at IS NOT NULL
         AND o.terminal_proof->>'process_closed'='true' AND o.terminal_proof->>'response_hash'=q.response_hash
       ORDER BY o.connection_id, o.selection_snapshot->>'model_id', o.selection_snapshot->>'effort_id', q.checked_at DESC, q.scope_hash`,
      [JSON.stringify(current)],
    );
    for (const row of receipts) {
      const selection: AiSelection = {
        connection_id: row.connection_id,
        mode: 'agentic',
        model_id: row.model_id,
        effort_id: row.effort_id,
      };
      if (
        row.scope_hash !==
        this.scopeHash(selection, {
          providerKey: 'gemini',
          connectionId: row.connection_id,
          keyId: null,
          configurationGeneration: row.configuration_generation,
          sessionGeneration: row.session_generation,
          resourceKey: row.resource_key,
          policyHash: row.policy_hash,
          runtimeHash: row.runtime_hash,
        })
      )
        continue;
      const models =
        choices.get(row.connection_id) ?? new Map<string, Set<string | null>>();
      const efforts = models.get(row.model_id) ?? new Set<string | null>();
      efforts.add(row.effort_id);
      models.set(row.model_id, efforts);
      choices.set(row.connection_id, models);
    }
    return choices;
  }

  async catalog(manager: EntityManager, after?: string) {
    if (after !== undefined && !validConnectionId(after)) {
      throw new BadRequestException('nodiaCv:invalid_cursor');
    }
    const limit = this.policy.results.list_default_rows;
    const rows = await this.connections.list(manager, after ?? null, limit);
    const visibleRows = rows.slice(0, limit);
    const geminiChoices = await this.geminiQualifications(manager, visibleRows);
    const items = [];
    // Reserve response envelope overhead and preserve whole connections when paginating.
    let bytes = 4096;
    for (const row of visibleRows) {
      const fields = configurationRecord(row.fields);
      const connection = projectNodiaAiConnection({
        ...row,
        fields:
          row.provider_key === 'openai' || row.provider_key === 'gemini'
            ? {
                ...fields,
                agentic: restrictAgenticModelFields(
                  configurationRecord(fields.agentic),
                ),
              }
            : fields,
      });
      const item = {
        ...connection,
        modes: connection.modes.map((mode) => {
          if (row.provider_key === 'gemini' && mode.mode === 'agentic') {
            const options = geminiChoices.get(row.id);
            const models = mode.models.flatMap((model) => {
              const exactEfforts = options?.get(model.model_id);
              if (!exactEfforts) return [];
              const efforts = model.efforts.filter((effort) =>
                exactEfforts.has(effort.effort_id),
              );
              return efforts.length || exactEfforts.has(null)
                ? [{ ...model, efforts }]
                : [];
            });
            const configured = mode.configured_selection;
            const configuredModel = models.find(
              (model) => model.model_id === configured?.model_id,
            );
            const configuredSelection =
              configuredModel &&
              configured &&
              (configured.effort_id === null
                ? options?.get(configured.model_id)?.has(null)
                : configuredModel.efforts.some(
                    (effort) => effort.effort_id === configured.effort_id,
                  ))
                ? configured
                : null;
            return {
              ...mode,
              models,
              configured_selection: configuredSelection,
              cv_transport: models.length
                ? ('available' as const)
                : ('unsupported' as const),
            };
          }
          return {
            ...mode,
            cv_transport:
              row.provider_key === 'openai' || row.provider_key === 'gemini'
                ? ('available' as const)
                : ('unsupported' as const),
          };
        }),
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
