import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import {
  NodiaAiAdapterError,
  NodiaAiAdapterPort,
  supportsNodiaAiTools,
  type NodiaAiAdapterObservation,
} from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import { NodiaAiConnectionsService } from '../nodia-ai-connections.service.js';
import type {
  NodiaAiRoutingTarget,
  NodiaAiSelection,
} from '../types/nodia-ai-persistence.types.js';
import { NodiaAiEligibilityQueryDto } from '../dto/nodia-ai-eligibility-query.dto.js';
import { validateNodiaAiDto } from '../dto/nodia-ai-validation.js';
import { projectNodiaAiConnection } from './list-nodia-ai-connections.use-case.js';
import { LoadNodiaAiKnowledgeUseCase } from '../../nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js';
import {
  INVOICE_OCR_FILE_BYTES,
  INVOICE_OCR_MEDIA_TYPES,
} from '../../nodia-ai-invoice-ocr/invoice-ocr-delivery.js';
import { observationIdentityManifest } from '../../nodia-ai-context/use-case/nodia-ai-observation-identity.js';
const safeReasons = new Set([
  'adapter_unconfigured',
  'adapter_transport_unavailable',
  'adapter_invalid_observation',
  'adapter_invalid_response',
  'adapter_connection_unavailable',
  'adapter_mode_unsupported',
  'session_required',
  'agentic_unavailable',
  'model_unavailable',
  'model_option_mismatch',
  'thinking_level_unsupported',
  'adapter_protocol_unverified',
  'runtime_busy',
  'runtime_unconfigured',
  'mcp_adapter_unverified',
  'agentic_timeout',
]);
/** Read-only non-generative preflight. It never probes MCP or grants authority to execute a turn. */
@Injectable()
export class ObserveNodiaAiEligibilityUseCase {
  constructor(
    private readonly connections: NodiaAiConnectionsService,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    private readonly adapter: NodiaAiAdapterPort,
    @Optional()
    private readonly knowledge?: LoadNodiaAiKnowledgeUseCase,
  ) {}
  async execute(
    identity: NodiaAiActorReference,
    connectionId: string,
    input: unknown,
  ) {
    if (
      !/^[1-9]\d{0,18}$/.test(connectionId) ||
      BigInt(connectionId) > 9223372036854775807n
    )
      throw new BadRequestException('nodia_ai:invalid_input');
    const query = validateNodiaAiDto(NodiaAiEligibilityQueryDto, input);
    const selection: NodiaAiSelection = {
      connection_id: connectionId,
      mode: query.mode,
      model_id: query.model_id,
      effort_id: query.effort_id ?? null,
    };
    const before = await this.configuration(identity, selection);
    const mode = before.modes.find((value) => value.mode === selection.mode)!;
    const supported =
      ['gemini', 'openai'].includes(before.provider_key) &&
      ['agentic', 'api_key'].includes(selection.mode);
    const enabled = mode.configuration !== 'disabled';
    const baseObservation =
      supported && enabled ? await this.observe(selection) : null;
    // Permissions and configuration can change while waiting for an external provider. No SQL lock crosses that wait.
    let invoiceOcrAllowed = false;
    await this.connections.transaction(async (manager) => {
      await lockAuthority(manager);
      const actor = await this.authorize.execute(identity, {}, manager);
      const row = await this.connections.find(manager, connectionId);
      if (
        !row ||
        JSON.stringify(projectNodiaAiConnection(row)) !== JSON.stringify(before)
      )
        throw new ConflictException('nodia_ai:eligibility_changed');
      if (baseObservation?.observation)
        await this.adapter.verifyConfiguration(
          selection,
          baseObservation.observation.configurationGeneration,
          manager,
        );
      invoiceOcrAllowed =
        this.knowledge?.manifest.capability_contracts.some(
          (contract) => contract.capability_id === 'nodia_invoices_ocr',
        ) === true &&
        baseObservation?.observation?.available === true &&
        supportsNodiaAiTools(baseObservation.observation) &&
        actor.modules.some((module) => module.route === '/business');
    });
    const observation = baseObservation?.observation;
    const routingTarget: NodiaAiRoutingTarget | null = null;
    return {
      selection,
      available: observation?.available === true,
      reason: !supported
        ? 'nodia_ai:adapter_mode_unsupported'
        : !enabled
          ? 'nodia_ai:adapter_connection_unavailable'
          : (baseObservation?.reason ?? null),
      observed_at: observation?.observedAt.toISOString() ?? null,
      supports_mcp:
        selection.mode === 'agentic' &&
        observation?.available === true &&
        observation.supportsMcp,
      supports_tools:
        observation?.available === true && supportsNodiaAiTools(observation),
      ...(selection.mode === 'api_key'
        ? {
            supports_image_generation:
              observation?.available === true &&
              observation.supportsImageGeneration === true,
          }
        : {}),
      routing_target: routingTarget,
      ...(invoiceOcrAllowed
        ? {
            invoice_ocr: {
              media_types: [...INVOICE_OCR_MEDIA_TYPES],
              file_bytes: INVOICE_OCR_FILE_BYTES,
            },
          }
        : {}),
    };
  }
  private async configuration(
    identity: NodiaAiActorReference,
    selection: NodiaAiSelection,
  ) {
    return this.connections.transaction(async (manager) => {
      await lockAuthority(manager);
      await this.authorize.execute(identity, {}, manager);
      const row = await this.connections.find(manager, selection.connection_id);
      if (!row) throw new NotFoundException('nodia_ai:connection_not_found');
      const result = projectNodiaAiConnection(row);
      const mode = result.modes.find((value) => value.mode === selection.mode)!;
      if (!mode.models.some((value) => value.model_id === selection.model_id))
        throw new BadRequestException('nodia_ai:invalid_selection');
      return result;
    });
  }
  private async observe(selection: NodiaAiSelection): Promise<{
    observation: NodiaAiAdapterObservation | null;
    reason: string | null;
  }> {
    try {
      const observation = await this.adapter.observe(selection);
      observationIdentityManifest(selection, observation);
      return {
        observation,
        reason: observation.available
          ? null
          : `nodia_ai:${observation.reason && safeReasons.has(observation.reason) ? observation.reason : 'adapter_unavailable'}`,
      };
    } catch (error) {
      if (
        error instanceof NodiaAiAdapterError &&
        error.code === 'adapter_configuration_changed'
      )
        throw new ConflictException('nodia_ai:eligibility_changed');
      return {
        observation: null,
        reason: `nodia_ai:${error instanceof NodiaAiAdapterError && safeReasons.has(error.code) ? error.code : 'adapter_unavailable'}`,
      };
    }
  }
}
