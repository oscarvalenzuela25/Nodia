import { Injectable } from '@nestjs/common';
import { AiProviderService } from '../ai-provider.service.js';
import { GeminiService } from '../../common/ai/gemini.service.js';
import { GetSelectableModelsDto } from '../dto/get-selectable-models.dto.js';
import { AiConnectionMode } from '../types/ai-provider.types.js';
import type { GeminiExecutionEngine } from '../../common/ai/ai.types.js';

export interface SelectableModelInfo {
  id: string;
  name: string;
  displayName: string;
  description: string;
  contextWindow: number;
  maxOutputTokens?: number;
  capabilities: string[];
  isRecommended?: boolean;
  isCurrent?: boolean;
  rateLimits?: {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
    requestsPerDay?: number;
  };
  remainingTokens?: number | string | null;
  totalTokens?: number | string | null;
  usagePercentage?: number | null;
  resetAt?: string | null;
}

export interface ProviderSelectableModelsResult {
  provider: string;
  mode: AiConnectionMode;
  planType: 'token_plan' | 'api_key';
  isSelected: boolean;
  isActive: boolean;
  selectedModel: string | null;
  models: SelectableModelInfo[];
  tokenPlan?: {
    tier: string;
    planLabel: string;
    authenticated: boolean;
    remainingCredits?: number | null;
    totalCredits?: number | null;
    usagePercentage?: number | null;
    resetAt?: string | null;
    window?: string | null;
    current5h?: {
      remainingCredits?: number | null;
      usagePercentage?: number | null;
      resetAt?: string | null;
    } | null;
    weekly?: {
      remainingCredits?: number | null;
      usagePercentage?: number | null;
      resetAt?: string | null;
    } | null;
  };
  apiKeyPlan?: {
    activeKeysCount: number;
    selectedKey: {
      id: string;
      label: string;
      displayHint: string;
      healthState: string;
      cooldownUntil: string | null;
      lastSuccessAt: string | null;
      lastErrorAt: string | null;
      lastErrorCode: string | null;
    } | null;
    autoRotateEnabled: boolean;
    keys: Array<{
      id: string;
      label: string;
      displayHint: string;
      healthState: string;
      isSelected: boolean;
      cooldownUntil: string | null;
    }>;
  };
}

@Injectable()
export class GetSelectableModelsUseCase {
  constructor(
    private readonly aiProviderService: AiProviderService,
    private readonly geminiService: GeminiService,
  ) {}

  async execute(dto: GetSelectableModelsDto = {}): Promise<ProviderSelectableModelsResult[]> {
    const { provider: filterProvider, mode: filterMode } = dto;

    const providersResponse = await this.aiProviderService.findAllProviders({
      page: 1,
      limit: 100,
      all: true,
      includes: true,
    });

    const providers = providersResponse.data || [];
    const results: ProviderSelectableModelsResult[] = [];

    const filteredProviders = filterProvider
      ? providers.filter((p: any) => p.key.toLowerCase() === filterProvider.toLowerCase())
      : providers;

    for (const prov of filteredProviders) {
      if (filterMode && prov.mode !== filterMode) {
        continue;
      }

      const selectedModel =
        prov.fields?.selected_model ||
        prov.fields?.model ||
        prov.fields?.chat_model ||
        null;

      const availableModels = Array.isArray(prov.fields?.available_models)
        ? prov.fields.available_models
        : [];

      const isTokenPlan =
        prov.mode === AiConnectionMode.WEB_SESSION ||
        prov.mode === 'token_plan_web' ||
        prov.mode === 'token_plan_agentic' ||
        prov.default_mode === 'token_plan_web' ||
        prov.default_mode === 'token_plan_agentic';

      if (isTokenPlan) {
        const targetEngine =
          prov.default_mode === 'token_plan_agentic' || prov.mode === 'token_plan_agentic'
            ? 'agentic'
            : prov.default_mode === 'token_plan_web' || prov.mode === 'token_plan_web'
              ? 'web'
              : prov.fields?.engine;

        const webRes = await this.buildWebSessionResult(
          prov.key,
          true,
          prov.is_active,
          selectedModel,
          availableModels,
          targetEngine,
        );
        results.push(webRes);
      } else {
        const apiRes = this.buildApiKeyResult(
          prov.key,
          prov.mode || AiConnectionMode.API_KEY,
          true,
          prov.is_active,
          selectedModel,
          availableModels,
          prov.api_keys || [],
          prov.auto_rotate_api_keys ?? true,
        );
        results.push(apiRes);
      }
    }

    return results;
  }

  private async buildWebSessionResult(
    provider: string,
    isSelected: boolean,
    isActive: boolean,
    selectedModel: string | null,
    availableModels: any[] = [],
    engine?: GeminiExecutionEngine,
  ): Promise<ProviderSelectableModelsResult> {
    const quotaData = await this.geminiService.getModelsAndQuota(engine);

    const rawModels = availableModels.length > 0 ? availableModels : (quotaData?.models || []);
    const models: SelectableModelInfo[] = rawModels.map((m: any) => {
      const isCurrent =
        (selectedModel && selectedModel === m.id) ||
        (!selectedModel && m.id === quotaData?.active_model);
      return {
        id: m.id,
        name: m.name || m.id,
        displayName: m.display_name || m.displayName || m.name || m.id,
        description: m.description || '',
        contextWindow: m.context_window || m.contextWindow || 1000000,
        capabilities: m.capabilities || ['text', 'vision', 'documents'],
        isRecommended: Boolean(m.isRecommended ?? String(m.id).toLowerCase().includes('flash')),
        isCurrent,
        remainingTokens:
          m.remaining_credits !== undefined && m.remaining_credits !== null
            ? `${m.remaining_credits} créditos`
            : 'Ilimitado / Según plan',
        totalTokens: m.total_credits ?? 48384,
        usagePercentage: m.usage_percentage ?? 0,
        resetAt: m.reset_time ? new Date(m.reset_time * 1000).toISOString() : null,
      };
    });

    const weeklyRemaining = quotaData?.usage_info?.weekly?.remaining_credits;
    const current5hRemaining = quotaData?.usage_info?.current_5h?.remaining_credits;

    return {
      provider,
      mode: AiConnectionMode.WEB_SESSION,
      planType: 'token_plan',
      isSelected,
      isActive,
      selectedModel: selectedModel || quotaData?.active_model || (models.length > 0 ? models[0].id : null),
      models,
      tokenPlan: {
        tier: quotaData?.tier || 'UNKNOWN',
        planLabel: quotaData?.plan_label || 'Plan Web',
        authenticated: Boolean(quotaData?.authenticated),
        remainingCredits: weeklyRemaining ?? current5hRemaining ?? null,
        totalCredits: 48384,
        usagePercentage: quotaData?.usage_info?.weekly?.usage_percentage ?? 0,
        resetAt: quotaData?.usage_info?.current_5h?.reset_at ?? quotaData?.usage_info?.weekly?.reset_at ?? null,
        window: quotaData?.usage_info?.current_5h?.window ?? '5h',
        current5h: quotaData?.usage_info?.current_5h ?? null,
        weekly: quotaData?.usage_info?.weekly ?? null,
      },
    };
  }

  private buildApiKeyResult(
    provider: string,
    mode: AiConnectionMode,
    isSelected: boolean,
    isActive: boolean,
    selectedModel: string | null,
    availableModels: any[] = [],
    apiKeys: any[] = [],
    autoRotateApiKeys: boolean = true,
  ): ProviderSelectableModelsResult {
    const activeKeys = apiKeys.filter((k) => k.is_active);
    const selectedKey = activeKeys.find((k) => k.is_selected) || activeKeys[0] || null;

    const models: SelectableModelInfo[] = availableModels.map((m: any) => {
      const isCurrent =
        (selectedModel && selectedModel === m.id) ||
        (!selectedModel && m.isRecommended);
      return {
        id: m.id,
        name: m.name || m.id,
        displayName: m.display_name || m.displayName || m.name || m.id,
        description: m.description || '',
        contextWindow: m.context_window || m.contextWindow || 128000,
        capabilities: m.capabilities || ['text'],
        isRecommended: Boolean(m.isRecommended),
        isCurrent,
        remainingTokens:
          selectedKey?.health_state === 'cooldown'
            ? 'En enfriamiento (cuota agotada temporalmente)'
            : m.remainingTokens || 'Según cuota de API Key',
      };
    });

    return {
      provider,
      mode,
      planType: 'api_key',
      isSelected,
      isActive,
      selectedModel:
        selectedModel ||
        (models.find((m) => m.isRecommended)?.id || models[0]?.id || null),
      models,
      apiKeyPlan: {
        activeKeysCount: activeKeys.length,
        autoRotateEnabled: autoRotateApiKeys,
        selectedKey: selectedKey
          ? {
              id: selectedKey.id,
              label: selectedKey.label,
              displayHint: selectedKey.display_hint,
              healthState: selectedKey.health_state,
              cooldownUntil: selectedKey.cooldown_until
                ? new Date(selectedKey.cooldown_until).toISOString()
                : null,
              lastSuccessAt: selectedKey.last_success_at
                ? new Date(selectedKey.last_success_at).toISOString()
                : null,
              lastErrorAt: selectedKey.last_error_at
                ? new Date(selectedKey.last_error_at).toISOString()
                : null,
              lastErrorCode: selectedKey.last_error_code || null,
            }
          : null,
        keys: activeKeys.map((k) => ({
          id: k.id,
          label: k.label,
          displayHint: k.display_hint,
          healthState: k.health_state,
          isSelected: k.is_selected,
          cooldownUntil: k.cooldown_until
            ? new Date(k.cooldown_until).toISOString()
            : null,
        })),
      },
    };
  }
}
