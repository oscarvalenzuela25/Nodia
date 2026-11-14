import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ApiProviderService } from '../../common/ai/api-provider.service.js';
import { observedModels } from '../helpers/model-observation.helper.js';
import { AiProviderService } from '../ai-provider.service.js';
import { GeminiService } from '../../common/ai/gemini.service.js';
import type { GeminiExecutionEngine } from '../../common/ai/ai.types.js';
import { CodexRuntimeService } from '../../common/ai/codex/codex-runtime.service.js';
export interface DiscoveredModelInfo {
  id: string;
  name: string;
  displayName: string;
  description: string;
  contextWindow: number | null;
  capabilities: string[];
  supportedReasoningEfforts?: string[];
  isRecommended: boolean;
  role?: 'chat' | 'multimodal' | 'ocr';
}
export interface SyncModelsResult {
  providerId: string;
  providerName: string;
  currentSelectedModel: string | null;
  isSelectedModelAvailable: boolean;
  models: DiscoveredModelInfo[];
  agenticPlan?: {
    tier: string;
    planLabel: string;
    authenticated: boolean;
  } | null;
}
@Injectable()
export class SyncAiProviderModelsUseCase {
  constructor(
    private readonly aiProviderService: AiProviderService,
    private readonly geminiService: GeminiService,
    @Optional()
    private readonly apiService?: ApiProviderService,
    @Optional()
    private readonly codex?: CodexRuntimeService,
  ) {}
  async execute(
    providerId: string,
    options?: {
      persist?: boolean;
      mode?: string;
      engine?: GeminiExecutionEngine;
    },
  ): Promise<SyncModelsResult> {
    const shouldPersist = options?.persist ?? true;
    const provider = await this.aiProviderService.findProviderById(providerId);
    if (!provider) {
      throw new NotFoundException(
        `AiProvider with ID "${providerId}" not found`,
      );
    }
    const engineKey = (
      provider.catalog?.key ||
      provider.key ||
      ''
    ).toLowerCase();
    const configuredMode =
      options?.mode ?? provider.default_mode ?? provider.mode;
    if (!configuredMode || !['agentic', 'api_key'].includes(configuredMode))
      throw new BadRequestException('ai_provider:mode_required');
    const targetMode = configuredMode;
    if (options?.engine && options.engine !== 'agentic') {
      throw new BadRequestException(
        'El motor solicitado no corresponde al modo de sesión.',
      );
    }
    const targetEngine: GeminiExecutionEngine | undefined =
      options?.engine ||
      (targetMode === 'agentic'
        ? 'agentic'
        : (provider.fields?.engine as GeminiExecutionEngine) || undefined);
    const modeFields =
      (provider.fields?.[targetMode] as Record<string, any>) || {};
    const hasAnyModeScoped =
      Boolean(provider.fields?.agentic) || Boolean(provider.fields?.api_key);
    const currentSelectedModel =
      modeFields.selected_model ||
      (!hasAnyModeScoped ? provider.fields?.selected_model : null) ||
      null;
    if (targetMode === 'api_key') {
      if (
        options?.engine ||
        provider.is_active === false ||
        provider.catalog?.is_active === false ||
        !provider.use_api_key ||
        provider.catalog?.can_use_api_key !== true
      )
        throw new BadRequestException(
          'El canal API no está habilitado para esta conexión.',
        );
      const secret = await this.aiProviderService.getActiveApiKeySecret(
        provider.id,
      );
      if (!secret || !this.apiService)
        throw new BadRequestException(
          'Debe agregar y seleccionar una API key activa.',
        );
      const models = await this.apiService.listModels(engineKey, secret);
      if (!models.length)
        throw new BadRequestException(
          'La API no entregó modelos disponibles para esta cuenta.',
        );
      if (shouldPersist)
        await this.aiProviderService.mergeDiscoveredModels(
          provider.id,
          'api_key',
          models,
        );
      return {
        providerId: provider.id,
        providerName: provider.name || provider.catalog.name,
        currentSelectedModel,
        isSelectedModelAvailable: models.some(
          (model) => model.id === currentSelectedModel,
        ),
        models,
        agenticPlan: null,
      };
    }
    if (!['agentic'].includes(targetMode))
      throw new BadRequestException('Modo de sesión inválido.');
    if (engineKey === 'openai' && targetMode === 'agentic') {
      if (
        !this.codex ||
        provider.is_active === false ||
        provider.catalog?.is_active === false ||
        provider.use_agentic !== true ||
        provider.catalog?.can_use_agentic !== true
      )
        throw new BadRequestException('El canal Codex no está habilitado.');
      const models = await this.codex.listModels(provider.id);
      if (!models.length)
        throw new BadRequestException('Codex no entregó modelos disponibles.');
      if (shouldPersist)
        await this.aiProviderService.mergeDiscoveredModels(
          provider.id,
          'agentic',
          models,
        );
      const session = await this.codex.observe(provider.id);
      return {
        providerId: provider.id,
        providerName: provider.name || provider.catalog.name,
        currentSelectedModel,
        isSelectedModelAvailable: models.some(
          (m) => m.id === currentSelectedModel,
        ),
        models,
        agenticPlan: session.planType
          ? {
              tier: session.planType,
              planLabel: session.planType,
              authenticated: session.authenticated === true,
            }
          : null,
      };
    }
    if (!['gemini', 'google'].includes(engineKey)) {
      throw new BadRequestException(
        'Este proveedor no tiene una integración de sesión verificada.',
      );
    }
    let discoveredModels: DiscoveredModelInfo[] = [];
    let agenticPlan: SyncModelsResult['agenticPlan'] = null;
    if (
      (engineKey === 'gemini' && targetMode !== 'api_key') ||
      targetMode === 'agentic'
    ) {
      const quotaData =
        await this.geminiService.getModelsAndQuota(targetEngine);
      if (
        !quotaData ||
        quotaData.authenticated !== true ||
        (targetEngine === 'agentic' && quotaData.available !== true)
      ) {
        throw new BadRequestException(
          'Agentic no esta disponible o no tiene sesion activa.',
        );
      }
      agenticPlan = {
        tier: quotaData.tier || 'UNKNOWN',
        planLabel: quotaData.plan_label || 'Agentic',
        authenticated: Boolean(quotaData.authenticated),
      };
      discoveredModels = observedModels(quotaData.models ?? []);
    } else {
      throw new BadRequestException('ai_provider:invalid_mode');
    }
    if (discoveredModels.length === 0) {
      throw new BadRequestException(
        `No se encontraron modelos disponibles para el proveedor "${provider.name || provider.key}".`,
      );
    }
    if (shouldPersist) {
      await this.aiProviderService.mergeDiscoveredModels(
        provider.id,
        targetMode as 'agentic',
        discoveredModels,
      );
    }
    const isSelectedModelAvailable = Boolean(
      currentSelectedModel &&
      discoveredModels.some((m) => m.id === currentSelectedModel),
    );
    return {
      providerId: provider.id,
      providerName: provider.name || provider.key || 'Proveedor',
      currentSelectedModel,
      isSelectedModelAvailable,
      models: discoveredModels,
      agenticPlan,
    };
  }
}
