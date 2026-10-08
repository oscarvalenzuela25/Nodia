export const AiConnectionMode = {
  WEB_SESSION: 'web_session',
  API_KEY: 'api_key',
  TOKEN_PLAN_AGENTIC: 'token_plan_agentic',
} as const;
export type AiConnectionMode =
  (typeof AiConnectionMode)[keyof typeof AiConnectionMode];

export const AiKeyHealthState = {
  UNTESTED: 'untested',
  VALID: 'valid',
  NEEDS_REVIEW: 'needs_review',
  COOLDOWN: 'cooldown',
} as const;
export type AiKeyHealthState =
  (typeof AiKeyHealthState)[keyof typeof AiKeyHealthState];

export interface SupportedModelDef {
  inputModalities?: string[] | null;
  supportedReasoningEfforts?: string[];
  id: string;
  name: string;
  displayName?: string;
  description: string;
  contextWindow?: number | null;
  capabilities: string[];
  isRecommended?: boolean;
  role?: 'chat' | 'multimodal' | 'ocr';
}

export interface SupportedProviderItem {
  key: string;
  name: string;
  description: string;
  defaultMode: AiConnectionMode;
  supportedModes: AiConnectionMode[];
  defaultSelectedModel?: string;
  defaultOcrModel?: string;
  availableModels?: SupportedModelDef[];
}

export interface SelectableModelInfo {
  inputModalities?: string[] | null;
  supportedReasoningEfforts?: string[];
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
  providerId?: string;
  models_source?: 'provider' | 'unavailable' | 'configuration';
  models_observed_at?: string | null;
  provider: string;
  mode: AiConnectionMode | 'token_plan_web' | 'token_plan_agentic';
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

export interface AiApiKeyEntity {
  id: string;
  provider_id: string;
  label: string;
  display_hint: string;
  sort_order: number;
  is_selected: boolean;
  health_state: AiKeyHealthState;
  last_error_code?: string | null;
  last_error_message?: string | null;
  last_error_at?: string | null;
  last_success_at?: string | null;
  cooldown_until?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAiApiKeyPayload {
  provider_id: string;
  label: string;
  secret: string;
  is_selected?: boolean;
  is_active?: boolean;
}
export interface UpdateAiApiKeyPayload {
  is_selected?: boolean;
  is_active?: boolean;
}
export interface GetAiApiKeysParams {
  page: number;
  limit: number;
  includes?: boolean;
  q: { provider_id_eq: string };
}

export interface AiProviderCatalogEntity {
  id: string;
  key: string;
  name: string;
  can_use_api_key?: boolean;
  can_use_token_plan_web?: boolean;
  can_use_token_plan_agentic?: boolean;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface AiProviderEntity {
  id: string;
  catalog_id?: string | null;
  name?: string | null;
  key?: string;
  mode?: AiConnectionMode | string | null;
  use_api_key?: boolean;
  use_token_plan_web?: boolean;
  use_token_plan_agentic?: boolean;
  default_mode?: 'api_key' | 'token_plan_web' | 'token_plan_agentic' | null;
  fields?: Record<string, unknown>;
  auto_rotate_api_keys?: boolean;
  is_default?: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  catalog?: AiProviderCatalogEntity;
  api_keys?: AiApiKeyEntity[];
  translates?: Array<{ key: string; es: string; en: string }>;
}

export interface DiscoveredModelItem {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  contextWindow?: number | null;
  capabilities?: string[];
  isRecommended?: boolean;
  role?: 'chat' | 'multimodal' | 'ocr';
}

export interface SyncModelsResult {
  providerId?: string;
  providerName?: string;
  currentSelectedModel?: string | null;
  isSelectedModelAvailable?: boolean;
  models: DiscoveredModelItem[];
  tokenPlan?: {
    tier: string;
    planLabel: string;
    authenticated: boolean;
  } | null;
  provider?: AiProviderEntity;
  synced_count?: number;
  selected_model?: string;
  is_selected_model_deprecated?: boolean;
}

export interface AiProviderEventEntity {
  id: string;
  provider_id: string;
  api_key_id?: string | null;
  actor_user_id?: string | null;
  event_type: string;
  reason_code: string;
  message: string;
  created_at: string;
  provider?: AiProviderEntity;
  api_key?: AiApiKeyEntity;
  actor_user?: {
    id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
  } | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
  };
}

export interface GetAiProvidersParams {
  page?: number;
  limit?: number;
  all?: boolean;
  includes?: boolean;
  q?: Record<string, unknown>;
}

export interface GetAiProviderEventsParams {
  page?: number;
  limit?: number;
  all?: boolean;
  includes?: boolean;
  q?: Record<string, unknown>;
}

export interface CreateAiProviderPayload {
  catalog_id?: string;
  name?: string;
  key?: string;
  mode?: AiConnectionMode | string;
  use_api_key?: boolean;
  use_token_plan_web?: boolean;
  use_token_plan_agentic?: boolean;
  default_mode?: 'api_key' | 'token_plan_web' | 'token_plan_agentic' | null;
  fields?: Record<string, unknown>;
  auto_rotate_api_keys?: boolean;
  is_default?: boolean;
  is_active?: boolean;
  translates?: Array<{ key: string; es: string; en: string }>;
}

export interface UpdateAiProviderPayload {
  catalog_id?: string;
  name?: string;
  mode?: AiConnectionMode | string;
  use_api_key?: boolean;
  use_token_plan_web?: boolean;
  use_token_plan_agentic?: boolean;
  default_mode?: 'api_key' | 'token_plan_web' | 'token_plan_agentic' | null;
  fields?: Record<string, unknown>;
  auto_rotate_api_keys?: boolean;
  is_default?: boolean;
  is_active?: boolean;
  translates?: Array<{ key: string; es: string; en: string }>;
}

export interface EnabledWebAiProvidersResponse {
  enabled_providers: string[];
}

export interface AiProviderAlert {
  id: string;
  provider: string;
  providerName?: string;
  reason?: 'agentic_session_required' | 'agentic_adapter_unavailable' | 'service_status_unknown';
  type: 'incident' | 'failover' | 'warning' | 'info';
  severity: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp?: string;
  timeAgo?: string;
  providerId?: string;
  actionType: 'renew_session' | 'manage_quotas' | 'configure' | 'authenticate_agentic' | 'check_status';
  actionLabel: string;
}

export interface AiProviderHealthItem {
  codexSession?: import('./codexSession').CodexSession;
  id: string;
  key: string;
  name: string;
  catalog_id?: string | null;
  catalog?: AiProviderCatalogEntity;
  isActive: boolean;
  is_default?: boolean;
  use_api_key?: boolean;
  use_token_plan_web?: boolean;
  use_token_plan_agentic?: boolean;
  default_mode?: 'api_key' | 'token_plan_web' | 'token_plan_agentic' | null;
  auto_rotate_api_keys?: boolean;
  mode: AiConnectionMode | null;
  status: 'healthy' | 'degraded' | 'expired' | 'unconfigured' | 'unverified';
  statusBadge: string;
  serviceState: string;
  lastCheck: string | null;
  latencyMs: number | null;
  autoFailover?: string;
  remoteBrowserProfile?: {
    location: string;
    engine: string;
  };
  failoverSwitch?: string;
  assignedModels?: Record<string, string>;
  selectedModel?: string;
  availableModels?: SupportedModelDef[];
  fields?: Record<string, unknown>;
  apiKeysCount?: number;
  validKeysCount?: number;
  selectedApiKey?: {
    id: string;
    label: string;
    display_hint: string;
    is_active: boolean;
  } | null;
  hasConnection: boolean;
  engine?: 'agentic' | 'web';
}

export interface AiProvidersHealthResponse {
  timestamp: string;
  engines: GeminiDualEngineStatus | null;
  overallStatus: 'healthy' | 'degraded' | 'incident';
  alerts: AiProviderAlert[];
  providers: AiProviderHealthItem[];
  summary: {
    totalProviders: number;
    activeProviders: number;
    healthyProviders: number;
    incidentsCount: number;
  };
}

export interface GetSelectableModelsParams {
  provider?: string;
  provider_id?: string;
  mode?: AiConnectionMode | 'token_plan_web' | 'token_plan_agentic';
}
export type GeminiLoginJob = {
  id: string;
  state: "running" | "succeeded" | "failed" | "cancelled";
};

export type GeminiExecutionEngine = 'agentic' | 'web';

export interface QuotaWindowMetric {
  type?: number;
  window: string;
  usage_percentage: number | null;
  remaining_credits?: number | null;
  usage_level?: number | null;
  reset_at?: string | null;
}

export interface ModelQuotaMetric {
  usage_percentage: number | null;
  remaining?: number | null;
  total?: number | null;
  reset_time?: number | null;
  action_id?: number | null;
  label?: string | null;
}

export interface GeminiEngineQuota {
  [key: string]: QuotaWindowMetric | ModelQuotaMetric | null | undefined;
  current_5h?: QuotaWindowMetric | null;
  weekly?: QuotaWindowMetric | null;
  flash?: ModelQuotaMetric | null;
  pro?: ModelQuotaMetric | null;
}

export interface GeminiEngineInfo {
  engine: GeminiExecutionEngine;
  available: boolean;
  authenticated: boolean;
  tier?: string | null;
  plan_label?: string;
  active_model?: string | null;
  models?: unknown[];
  error?: string | null;
  runtime_found?: boolean;
  ls_address?: string | null;
  cookies_valid?: boolean;
  quota?: GeminiEngineQuota | null;
  quota_source?: string | null;
  quota_observed_at?: number | null;
  supported_options?: { extended_thinking: boolean | null } | null;
}

export interface GeminiDualEngineStatus {
  active_engine: GeminiExecutionEngine | null;
  default_engine?: GeminiExecutionEngine;
  agentic: GeminiEngineInfo;
  web: GeminiEngineInfo;
}
