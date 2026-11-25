import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { agenticHash } from '../../ai-generation/agentic-text-contract.js';
import type { AiSelection } from '../../ai-generation/ai-selection.js';
import { isAgenticModelAllowed } from '../../ai-provider/helpers/agentic-model-policy.helper.js';
import type { CodexChatObservation } from '../../common/ai/codex/codex-chat-contract.js';
import { CodexChatRuntime } from '../../common/ai/codex/codex-chat-runtime.js';
import { CodexOperationException } from '../../common/ai/codex/codex-contract.js';
import { NodiaAiConnectionsService } from '../../nodia-ai-conversation/nodia-ai-connections.service.js';

type ConfigurationStatus =
  | 'agentic_selection_invalid'
  | 'agentic_connection_unavailable'
  | 'codex_model_not_allowed';

type ObservationStatus =
  | ConfigurationStatus
  | 'configuration_changed'
  | 'codex_effort_unavailable'
  | 'codex_model_unavailable'
  | 'codex_profile_busy'
  | 'codex_protocol_invalid'
  | 'codex_runtime_unavailable'
  | 'codex_session_required'
  | 'codex_session_unverified'
  | 'codex_timeout'
  | 'codex_usage_unavailable';

export interface CvCodexSelectionReady {
  status: 'metadata_ready';
  qualified: false;
  selection: Readonly<AiSelection> & { mode: 'agentic' };
  providerKey: 'openai';
  configurationGeneration: string;
  sessionGeneration: string;
  resourceKey: string;
  checkedAt: string;
}

export type CvCodexSelectionObservation =
  | CvCodexSelectionReady
  | {
      status: ObservationStatus;
      qualified: false;
      selection: Readonly<AiSelection>;
      checkedAt: string | null;
    };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isCodexSelection(
  selection: AiSelection,
): selection is AiSelection & { mode: 'agentic' } {
  return (
    selection.mode === 'agentic' &&
    typeof selection.connection_id === 'string' &&
    /^[1-9][0-9]{0,18}$/.test(selection.connection_id) &&
    BigInt(selection.connection_id) <= 9223372036854775807n &&
    typeof selection.model_id === 'string' &&
    selection.model_id.length > 0 &&
    selection.model_id === selection.model_id.trim() &&
    !/[\p{Cc}\p{Cs}\p{Bidi_Control}]/u.test(selection.model_id) &&
    Buffer.byteLength(selection.model_id, 'utf8') <= 1024 &&
    (selection.effort_id === null ||
      (typeof selection.effort_id === 'string' &&
        /^[a-z][a-z0-9_-]{0,31}$/.test(selection.effort_id)))
  );
}

function codexObservationFailure(code: string): ObservationStatus | null {
  switch (code) {
    case 'codex_profile_busy':
    case 'codex_protocol_invalid':
    case 'codex_runtime_unavailable':
    case 'codex_session_required':
    case 'codex_timeout':
      return code;
    case 'codex_resource_limit':
      return 'codex_protocol_invalid';
    case 'codex_login_unknown':
      return 'codex_runtime_unavailable';
    default:
      return null;
  }
}

/** Read-only account and model preflight for CV's independent transport and qualification. */
@Injectable()
export class NodiaCvCodexSelection {
  constructor(
    private readonly connections: NodiaAiConnectionsService,
    private readonly runtime: CodexChatRuntime,
  ) {}

  private async configured(manager: EntityManager, selection: AiSelection) {
    if (!isCodexSelection(selection)) {
      return { status: 'agentic_selection_invalid' } as const;
    }
    const row = await this.connections.find(manager, selection.connection_id);
    if (
      !row ||
      row.id !== selection.connection_id ||
      row.provider_key !== 'openai' ||
      row.is_active !== true ||
      row.catalog_active !== true ||
      row.use_agentic !== true ||
      row.can_use_agentic !== true ||
      !row.configuration_updated_at
    ) {
      return { status: 'agentic_connection_unavailable' } as const;
    }
    const updatedAt = new Date(row.configuration_updated_at);
    const fields = record(row.fields);
    const agentic = fields?.agentic ?? null;
    if (
      !Number.isFinite(updatedAt.getTime()) ||
      (row.fields != null && !fields) ||
      (agentic !== null && !record(agentic))
    ) {
      return { status: 'agentic_connection_unavailable' } as const;
    }
    if (!isAgenticModelAllowed(agentic, selection.model_id)) {
      return { status: 'codex_model_not_allowed' } as const;
    }
    return {
      status: 'configured',
      // The same canonical generation used by Codex for this connection's Agentic configuration.
      configurationGeneration: agenticHash({
        connection_id: row.id,
        provider_key: row.provider_key,
        mode: selection.mode,
        fields: agentic,
        updated_at: updatedAt,
        enabled: true,
      }),
    } as const;
  }

  /** For the authority transaction after live observation; this method only reads SQL. */
  async matchesConfiguration(
    manager: EntityManager,
    observed: CvCodexSelectionReady,
  ): Promise<boolean> {
    const current = await this.configured(manager, observed.selection);
    return (
      current.status === 'configured' &&
      current.configurationGeneration === observed.configurationGeneration
    );
  }

  async observe(
    selection: AiSelection,
    signal: AbortSignal,
  ): Promise<CvCodexSelectionObservation> {
    const requested: AiSelection = {
      connection_id: selection.connection_id,
      mode: selection.mode,
      model_id: selection.model_id,
      effort_id: selection.effort_id,
    };
    const rejected = (
      status: ObservationStatus,
      checkedAt: string | null = null,
    ): CvCodexSelectionObservation => ({
      status,
      selection: requested,
      qualified: false,
      checkedAt,
    });
    signal.throwIfAborted();
    if (!isCodexSelection(requested)) {
      return rejected('agentic_selection_invalid');
    }
    const before = await this.connections.transaction((manager) =>
      this.configured(manager, requested),
    );
    signal.throwIfAborted();
    if (before.status !== 'configured') return rejected(before.status);

    let native: CodexChatObservation;
    const timeout = AbortSignal.timeout(30_000);
    const observationSignal = AbortSignal.any([signal, timeout]);
    try {
      // This method holds one native lease across account/read and model/list.
      native = await this.runtime.observe(
        requested.connection_id,
        observationSignal,
      );
      observationSignal.throwIfAborted();
    } catch (error) {
      signal.throwIfAborted();
      if (timeout.aborted) return rejected('codex_timeout');
      if (error instanceof CodexOperationException) {
        const status = codexObservationFailure(error.code);
        if (status) return rejected(status);
      }
      throw error;
    }

    // Configuration may have changed while the native metadata read was in flight.
    const current = await this.connections.transaction((manager) =>
      this.configured(manager, requested),
    );
    signal.throwIfAborted();
    if (
      current.status !== 'configured' ||
      before.configurationGeneration !== current.configurationGeneration
    ) {
      return rejected('configuration_changed');
    }

    const { session } = native;
    const checkedAt =
      typeof session.checkedAt === 'string' &&
      Number.isFinite(Date.parse(session.checkedAt))
        ? session.checkedAt
        : null;
    if (!session.available) {
      return rejected(
        session.reason === 'codex_profile_busy'
          ? 'codex_profile_busy'
          : 'codex_runtime_unavailable',
        checkedAt,
      );
    }
    if (session.authenticated !== true) {
      return rejected(
        session.authenticated === false && checkedAt
          ? 'codex_session_required'
          : 'codex_session_unverified',
        checkedAt,
      );
    }
    if (
      !checkedAt ||
      !/^codex-profile:[a-f0-9]{64}$/.test(native.resourceKey) ||
      !/^[a-f0-9]{32}$/.test(native.runtimeSessionId)
    ) {
      return rejected('codex_protocol_invalid', checkedAt);
    }
    if (session.usageAllowed === false) {
      return rejected('codex_usage_unavailable', checkedAt);
    }
    const matches = native.models.filter(
      (model) => model.id === requested.model_id,
    );
    if (matches.length > 1)
      return rejected('codex_protocol_invalid', checkedAt);
    const model = matches[0];
    if (!model) return rejected('codex_model_unavailable', checkedAt);
    if (
      requested.effort_id !== null &&
      !model.supportedReasoningEfforts.includes(requested.effort_id)
    ) {
      return rejected('codex_effort_unavailable', checkedAt);
    }
    return {
      status: 'metadata_ready',
      qualified: false,
      selection: requested,
      providerKey: 'openai',
      configurationGeneration: current.configurationGeneration,
      sessionGeneration: native.runtimeSessionId,
      resourceKey: native.resourceKey,
      checkedAt,
    };
  }
}
