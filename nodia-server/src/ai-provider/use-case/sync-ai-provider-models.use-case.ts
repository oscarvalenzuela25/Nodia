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

export interface DiscoveredModelInfo {
  id: string;
  name: string;
  displayName: string;
  description: string;
  contextWindow: number | null;
  capabilities: string[];
  isRecommended: boolean;
  role?: 'chat' | 'multimodal' | 'ocr';
}

export interface SyncModelsResult {
  providerId: string;
  providerName: string;
  currentSelectedModel: string | null;
  isSelectedModelAvailable: boolean;
  models: DiscoveredModelInfo[];
  tokenPlan?: {
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
    @Optional() private readonly apiService?: ApiProviderService,
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
      options?.mode || provider.default_mode || provider.mode || 'api_key';

    const targetMode = configuredMode === 'web_session' ? 'token_plan_web' : configuredMode;
    if (options?.engine && options.engine !== (targetMode === 'token_plan_agentic' ? 'agentic' : 'web')) {
      throw new BadRequestException('El motor solicitado no corresponde al modo de sesión.');
    }
    const targetEngine: GeminiExecutionEngine | undefined =
      options?.engine ||
      (targetMode === 'token_plan_agentic'
        ? 'agentic'
        : targetMode === 'token_plan_web'
          ? 'web'
          : (provider.fields?.engine as GeminiExecutionEngine) || undefined);

    const modeFields =
      (provider.fields?.[targetMode] as Record<string, any>) || {};
    const hasAnyModeScoped =
      Boolean(provider.fields?.token_plan_agentic) ||
      Boolean(provider.fields?.token_plan_web) ||
      Boolean(provider.fields?.api_key);

    const currentSelectedModel =
      modeFields.selected_model ||
      (!hasAnyModeScoped
        ? provider.fields?.selected_model
        : null) ||
      null;

    if (targetMode === 'api_key') {
      if (options?.engine || provider.is_active === false || provider.catalog?.is_active === false || !provider.use_api_key || provider.catalog?.can_use_api_key !== true) throw new BadRequestException('El canal API no está habilitado para esta conexión.');
      const secret = await this.aiProviderService.getActiveApiKeySecret(provider.id);
      if (!secret || !this.apiService) throw new BadRequestException('Debe agregar y seleccionar una API key activa.');
      const models = await this.apiService.listModels(engineKey, secret);
      if (!models.length) throw new BadRequestException('La API no entregó modelos disponibles para esta cuenta.');
      if (shouldPersist) await this.aiProviderService.updateProviderFields(provider.id, {
        ...provider.fields, api_key: { ...modeFields, available_models: models },
      });
      return { providerId: provider.id, providerName: provider.name || provider.catalog.name,
        currentSelectedModel, isSelectedModelAvailable: models.some((model) => model.id === currentSelectedModel), models, tokenPlan: null };
    }
    if (!['token_plan_web', 'token_plan_agentic'].includes(targetMode)) throw new BadRequestException('Modo de sesión inválido.');
    if (!['gemini', 'google'].includes(engineKey)) {
      throw new BadRequestException('Este proveedor no tiene una integración de sesión verificada.');
    }

    let discoveredModels: DiscoveredModelInfo[] = [];
    let tokenPlan: SyncModelsResult['tokenPlan'] = null;

    if (
      (engineKey === 'gemini' && targetMode !== 'api_key') ||
      targetMode === 'token_plan_web' ||
      targetMode === 'token_plan_agentic'
    ) {
      const quotaData =
        await this.geminiService.getModelsAndQuota(targetEngine);

      if (!quotaData || quotaData.authenticated !== true || (targetEngine === 'agentic' && quotaData.available !== true)) {
        throw new BadRequestException(
          targetEngine === 'agentic'
            ? 'El entorno de Antigravity (Agentic) no está disponible o no tiene sesión activa.'
            : 'La sesión web de Gemini no está activa o no ha sido autenticada en el microservicio.',
        );
      }

      tokenPlan = {
        tier: quotaData.tier || 'UNKNOWN',
        planLabel:
          quotaData.plan_label ||
          (targetEngine === 'agentic'
            ? 'Token Plan (Agentic)'
            : 'Token Plan (Web)'),
        authenticated: Boolean(quotaData.authenticated),
      };

      discoveredModels = observedModels(quotaData.models ?? []);
    } else {
      throw new BadRequestException('Solo se admiten sesiones Gemini Web o Antigravity; el modo API Key no está habilitado.');
    }

    if (discoveredModels.length === 0) {
      throw new BadRequestException(
        `No se encontraron modelos disponibles para el proveedor "${provider.name || provider.key}".`,
      );
    }

    if (shouldPersist) {
      // Persist discovered models into provider fields in database scoped to the mode
      const updatedFields = {
        ...provider.fields,
        [targetMode]: {
          ...modeFields,
          available_models: discoveredModels,
        },
      };
      await this.aiProviderService.updateProviderFields(
        provider.id,
        updatedFields,
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
      tokenPlan,
    };
  }

}
