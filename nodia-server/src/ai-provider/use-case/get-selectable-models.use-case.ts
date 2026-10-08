import { Injectable, Optional } from '@nestjs/common';
import { ApiProviderService } from '../../common/ai/api-provider.service.js';
import { AiProviderService } from '../ai-provider.service.js';
import { GeminiService } from '../../common/ai/gemini.service.js';
import { GetSelectableModelsDto } from '../dto/get-selectable-models.dto.js';
import { observedModels } from '../helpers/model-observation.helper.js';
import { observedWebQuota } from '../../common/ai/gemini-quota-observation.js';

export interface SelectableModelInfo {
  id: string;
  name: string;
  displayName: string;
  description: string;
  contextWindow: number | null;
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
  providerId: string;
  models_source: 'provider' | 'unavailable' | 'configuration';
  models_observed_at: string | null;
  provider: string;
  mode: string;
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
  constructor(private readonly aiProviderService: AiProviderService, private readonly geminiService: GeminiService, @Optional() private readonly apiService?: ApiProviderService) {}

  async execute(dto: GetSelectableModelsDto = {}): Promise<ProviderSelectableModelsResult[]> {
    const response = await this.aiProviderService.findAllProviders({ all: true, includes: true });
    const results: ProviderSelectableModelsResult[] = [];
    for (const provider of response.data ?? []) {
      const key = provider.catalog?.key ?? provider.key ?? '';
      if (dto.provider && key.toLowerCase() !== dto.provider.toLowerCase()) continue;
      if (dto.provider_id && String(provider.id) !== dto.provider_id) continue;
      const mode = dto.mode ?? provider.default_mode ?? provider.mode;
      const actualMode = mode === 'web_session' ? 'token_plan_web' : mode;
      const enabled = actualMode === 'token_plan_web'
        ? provider.use_token_plan_web ?? (provider.mode === 'web_session' || provider.mode === 'token_plan_web')
        : actualMode === 'token_plan_agentic'
          ? provider.use_token_plan_agentic ?? (provider.mode === 'token_plan_agentic')
          : provider.use_api_key ?? provider.mode === 'api_key';
      if (dto.mode && !enabled) continue;
      const scoped = provider.fields?.[actualMode];
      const hasScoped = Boolean(provider.fields?.token_plan_web || provider.fields?.token_plan_agentic || provider.fields?.api_key);
      const fields = scoped ?? (hasScoped ? {} : provider.fields ?? {});
      const selectedModel = fields.selected_model || fields.model || fields.chat_model || null;
      const tokenMode = actualMode === 'token_plan_web' || actualMode === 'token_plan_agentic';
      const base = { providerId: String(provider.id), provider: key, mode: mode ?? 'api_key',
        planType: tokenMode ? 'token_plan' as const : 'api_key' as const,
        isSelected: provider.is_default === true, isActive: provider.is_active === true, selectedModel };
      if (actualMode === 'api_key' && enabled && provider.is_active && provider.catalog?.is_active !== false && provider.catalog?.can_use_api_key === true && this.apiService) {
        const secret = await this.aiProviderService.getActiveApiKeySecret(String(provider.id));
        const models = secret ? await this.apiService.listModels(key, secret) : [];
        results.push({ ...base, models, models_source: secret ? 'provider' : 'unavailable', models_observed_at: secret ? new Date().toISOString() : null });
        continue;
      }
      if (!tokenMode || !['gemini', 'google'].includes(key.toLowerCase())) {
        results.push({ ...base, models: [], models_source: 'configuration', models_observed_at: null });
        continue;
      }
      const engine = actualMode === 'token_plan_agentic' ? 'agentic' : 'web';
      const discovery = await this.geminiService.getModelsAndQuota(engine);
      const authenticated = engine === 'agentic'
        ? discovery?.available === true && discovery?.authenticated === true
        : discovery?.authenticated === true;
      const models = authenticated ? observedModels(discovery?.models ?? []).map((model) => ({
        ...model, isCurrent: model.id === selectedModel,
        remainingTokens: null, totalTokens: null, usagePercentage: null, resetAt: null,
      })) : [];
      const quota = engine === 'web' ? observedWebQuota(discovery) : null;
      const windowMetric = (value: unknown) => {
        if (!value || typeof value !== 'object') return null;
        const metric = value as Record<string, unknown>;
        return { remainingCredits: metric.remaining_credits as number | null,
          usagePercentage: metric.usage_percentage as number | null, resetAt: metric.reset_at as string | null };
      };
      results.push({ ...base, models, models_source: authenticated ? 'provider' : 'unavailable',
        models_observed_at: authenticated ? new Date().toISOString() : null,
        tokenPlan: { tier: typeof discovery?.tier === 'string' ? discovery.tier : 'UNKNOWN',
          planLabel: typeof discovery?.plan_label === 'string' ? discovery.plan_label : 'Plan no identificado',
          authenticated, remainingCredits: null, totalCredits: null, usagePercentage: null,
          resetAt: null, window: null,
          current5h: windowMetric(quota?.usage.current_5h), weekly: windowMetric(quota?.usage.weekly),
        },
      });
    }
    return results;
  }
}
