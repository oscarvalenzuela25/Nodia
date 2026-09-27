import { Injectable } from '@nestjs/common';
import { AiProviderService } from '../ai-provider.service.js';
import { GeminiService } from '../../common/ai/gemini.service.js';
import { GetSelectableModelsDto } from '../dto/get-selectable-models.dto.js';
import { AiConnectionMode } from '../types/ai-provider.types.js';

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

const STATIC_MODELS: Record<string, SelectableModelInfo[]> = {
  gemini: [
    {
      id: 'gemini-flash',
      name: 'gemini-flash',
      displayName: 'Gemini 3.8 Flash',
      description: 'Modelo insignia para velocidad, multimodalidad y razonamiento ágil (Google Web / AI Premium)',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      capabilities: ['text', 'vision', 'audio', 'documents'],
      isRecommended: true,
      remainingTokens: '48,384 créditos',
      totalTokens: 48384,
    },
    {
      id: 'gemini-pro',
      name: 'gemini-pro',
      displayName: 'Gemini 3.1 Pro',
      description: 'Razonamiento complejo avanzado, código y análisis profundo (Google Web / AI Premium)',
      contextWindow: 2000000,
      maxOutputTokens: 8192,
      capabilities: ['text', 'vision', 'audio', 'documents', 'thinking'],
      isRecommended: false,
      remainingTokens: '48,384 créditos',
      totalTokens: 48384,
    },
  ],
  mistral: [
    {
      id: 'mistral-ocr-latest',
      name: 'mistral-ocr-latest',
      displayName: 'Mistral OCR',
      description: 'Extracción y análisis óptico especializado de documentos y facturas',
      contextWindow: 131072,
      maxOutputTokens: 8192,
      capabilities: ['ocr', 'documents', 'vision'],
      isRecommended: true,
      remainingTokens: 'Ilimitado (Por página)',
    },
    {
      id: 'open-mistral-nemo',
      name: 'open-mistral-nemo',
      displayName: 'Mistral Nemo 12B',
      description: 'Modelo eficiente y multilingüe de uso general',
      contextWindow: 131072,
      maxOutputTokens: 16384,
      capabilities: ['text', 'multilingual'],
      rateLimits: { requestsPerMinute: 5, tokensPerMinute: 100000 },
      remainingTokens: '100,000 TPM',
      totalTokens: 100000,
    },
    {
      id: 'mistral-large-latest',
      name: 'mistral-large-latest',
      displayName: 'Mistral Large',
      description: 'Modelo insignia para razonamiento complejo y análisis de contratos',
      contextWindow: 131072,
      maxOutputTokens: 32768,
      capabilities: ['text', 'reasoning', 'multilingual'],
      rateLimits: { requestsPerMinute: 5, tokensPerMinute: 100000 },
      remainingTokens: '100,000 TPM',
      totalTokens: 100000,
    },
    {
      id: 'pixtral-12b-2409',
      name: 'pixtral-12b-2409',
      displayName: 'Pixtral 12B',
      description: 'Modelo multimodal con visión nativa y comprensión de imágenes complejas',
      contextWindow: 131072,
      maxOutputTokens: 16384,
      capabilities: ['text', 'vision', 'documents'],
      remainingTokens: '100,000 TPM',
      totalTokens: 100000,
    },
  ],
  openai: [
    {
      id: 'gpt-4o',
      name: 'gpt-4o',
      displayName: 'GPT-4o',
      description: 'Modelo insignia multimodal de alta inteligencia',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      capabilities: ['text', 'vision', 'json'],
      isRecommended: true,
      rateLimits: { requestsPerMinute: 500, tokensPerMinute: 30000 },
      remainingTokens: '30,000 TPM',
      totalTokens: 30000,
    },
    {
      id: 'gpt-4o-mini',
      name: 'gpt-4o-mini',
      displayName: 'GPT-4o Mini',
      description: 'Modelo rápido y ligero para tareas comunes',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      capabilities: ['text', 'vision', 'json'],
      rateLimits: { requestsPerMinute: 500, tokensPerMinute: 200000 },
      remainingTokens: '200,000 TPM',
      totalTokens: 200000,
    },
    {
      id: 'o1',
      name: 'o1',
      displayName: 'OpenAI o1',
      description: 'Razonamiento lógico deliberado y matemático de máxima profundidad',
      contextWindow: 200000,
      maxOutputTokens: 100000,
      capabilities: ['text', 'vision', 'reasoning'],
      isRecommended: false,
    },
    {
      id: 'o3-mini',
      name: 'o3-mini',
      displayName: 'OpenAI o3-mini',
      description: 'Razonamiento veloz y eficiente para código, lógica y ciencia',
      contextWindow: 200000,
      maxOutputTokens: 100000,
      capabilities: ['text', 'reasoning', 'code'],
      isRecommended: false,
    },
  ],
  anthropic: [
    {
      id: 'claude-3-7-sonnet-latest',
      name: 'claude-3-7-sonnet-latest',
      displayName: 'Claude 3.7 Sonnet',
      description: 'Modelo híbrido de razonamiento estándar y extendido de vanguardia',
      contextWindow: 200000,
      maxOutputTokens: 64000,
      capabilities: ['text', 'vision', 'reasoning', 'code'],
      isRecommended: true,
    },
    {
      id: 'claude-3-5-sonnet-latest',
      name: 'claude-3-5-sonnet-latest',
      displayName: 'Claude 3.5 Sonnet',
      description: 'Equilibrio perfecto entre inteligencia superior y velocidad de ejecución',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      capabilities: ['text', 'vision', 'code'],
      isRecommended: false,
    },
    {
      id: 'claude-3-5-haiku-latest',
      name: 'claude-3-5-haiku-latest',
      displayName: 'Claude 3.5 Haiku',
      description: 'Velocidad casi instantánea y excelente rendimiento en tareas cotidianas',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      capabilities: ['text', 'vision'],
      isRecommended: false,
    },
  ],
  deepseek: [
    {
      id: 'deepseek-chat',
      name: 'deepseek-chat',
      displayName: 'DeepSeek-V3',
      description: 'Modelo general conversacional de arquitectura MoE de alta capacidad',
      contextWindow: 64000,
      maxOutputTokens: 8192,
      capabilities: ['text', 'code', 'json'],
      isRecommended: true,
    },
    {
      id: 'deepseek-reasoner',
      name: 'deepseek-reasoner',
      displayName: 'DeepSeek-R1',
      description: 'Modelo de razonamiento por cadena de pensamiento (CoT) para problemas complejos',
      contextWindow: 64000,
      maxOutputTokens: 8192,
      capabilities: ['text', 'reasoning', 'code'],
      isRecommended: false,
    },
  ],
  xai: [
    {
      id: 'grok-2-latest',
      name: 'grok-2-latest',
      displayName: 'Grok 2',
      description: 'Modelo insignia de xAI con razonamiento avanzado y comprensión general',
      contextWindow: 131072,
      maxOutputTokens: 8192,
      capabilities: ['text', 'reasoning', 'code'],
      isRecommended: true,
    },
    {
      id: 'grok-2-vision-1212',
      name: 'grok-2-vision-1212',
      displayName: 'Grok 2 Vision',
      description: 'Comprensión visual avanzada de diagramas, imágenes y comprobantes',
      contextWindow: 32768,
      maxOutputTokens: 8192,
      capabilities: ['text', 'vision', 'documents'],
      isRecommended: false,
    },
  ],
  groq: [
    {
      id: 'llama-3.3-70b-versatile',
      name: 'llama-3.3-70b-versatile',
      displayName: 'Llama 3.3 70B (Groq)',
      description: 'Modelo de 70B parámetros optimizado para inferencia instantánea',
      contextWindow: 128000,
      maxOutputTokens: 8192,
      capabilities: ['text', 'code', 'json'],
      isRecommended: true,
    },
    {
      id: 'llama-3.1-8b-instant',
      name: 'llama-3.1-8b-instant',
      displayName: 'Llama 3.1 8B Instant',
      description: 'Inferencia ultra veloz a más de 500 tokens/s para clasificaciones rápidas',
      contextWindow: 128000,
      maxOutputTokens: 8192,
      capabilities: ['text', 'json'],
      isRecommended: false,
    },
    {
      id: 'mixtral-8x7b-32768',
      name: 'mixtral-8x7b-32768',
      displayName: 'Mixtral 8x7B (Groq)',
      description: 'Arquitectura MoE con ventana amplia de contexto y alta tasa de respuesta',
      contextWindow: 32768,
      maxOutputTokens: 8192,
      capabilities: ['text', 'code'],
      isRecommended: false,
    },
  ],
  cohere: [
    {
      id: 'command-r-plus-latest',
      name: 'command-r-plus-latest',
      displayName: 'Command R+',
      description: 'Modelo insignia de Cohere diseñado para flujos de trabajo empresariales y RAG',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      capabilities: ['text', 'rag', 'json'],
      isRecommended: true,
    },
    {
      id: 'command-r-latest',
      name: 'command-r-latest',
      displayName: 'Command R',
      description: 'Optimizado para alta eficiencia, tareas operativas y búsqueda semántica',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      capabilities: ['text', 'rag'],
      isRecommended: false,
    },
  ],
  perplexity: [
    {
      id: 'sonar-pro',
      name: 'sonar-pro',
      displayName: 'Sonar Pro',
      description: 'Modelo insignia de búsqueda con citas web y razonamiento enriquecido',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      capabilities: ['text', 'web_search', 'citations'],
      isRecommended: true,
    },
    {
      id: 'sonar',
      name: 'sonar',
      displayName: 'Sonar',
      description: 'Búsqueda veloz en tiempo real y síntesis concisa de información',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      capabilities: ['text', 'web_search'],
      isRecommended: false,
    },
  ],
  openrouter: [
    {
      id: 'auto',
      name: 'auto',
      displayName: 'OpenRouter Auto Router',
      description: 'Enrutamiento dinámico al proveedor más rápido y disponible automáticamente',
      contextWindow: 128000,
      maxOutputTokens: 8192,
      capabilities: ['text', 'routing', 'failover'],
      isRecommended: true,
    },
    {
      id: 'anthropic/claude-3.7-sonnet',
      name: 'anthropic/claude-3.7-sonnet',
      displayName: 'Claude 3.7 Sonnet (via OpenRouter)',
      description: 'Acceso a Claude 3.7 Sonnet con balanceo automático',
      contextWindow: 200000,
      maxOutputTokens: 64000,
      capabilities: ['text', 'vision', 'reasoning'],
      isRecommended: false,
    },
    {
      id: 'openai/gpt-4o',
      name: 'openai/gpt-4o',
      displayName: 'GPT-4o (via OpenRouter)',
      description: 'Acceso a OpenAI GPT-4o a través de OpenRouter API',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      capabilities: ['text', 'vision', 'json'],
      isRecommended: false,
    },
    {
      id: 'deepseek/deepseek-r1',
      name: 'deepseek/deepseek-r1',
      displayName: 'DeepSeek R1 (via OpenRouter)',
      description: 'Razonamiento avanzado por cadena de pensamiento servido globalmente',
      contextWindow: 64000,
      maxOutputTokens: 8192,
      capabilities: ['text', 'reasoning'],
      isRecommended: false,
    },
  ],
  together: [
    {
      id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      name: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      displayName: 'Llama 3.3 70B Turbo',
      description: 'Inferencia acelerada de Llama 3.3 para aplicaciones de producción',
      contextWindow: 131072,
      maxOutputTokens: 8192,
      capabilities: ['text', 'code', 'json'],
      isRecommended: true,
    },
    {
      id: 'deepseek-ai/DeepSeek-R1',
      name: 'deepseek-ai/DeepSeek-R1',
      displayName: 'DeepSeek R1 (Together)',
      description: 'Razonamiento profundo abierto alojado en clusters de alta velocidad',
      contextWindow: 64000,
      maxOutputTokens: 8192,
      capabilities: ['text', 'reasoning'],
      isRecommended: false,
    },
  ],
  ollama: [
    {
      id: 'llama3.3',
      name: 'llama3.3',
      displayName: 'Llama 3.3 (Local)',
      description: 'Modelo local más reciente de Meta para procesamiento privado',
      contextWindow: 128000,
      maxOutputTokens: 8192,
      capabilities: ['text', 'code', 'json'],
      isRecommended: true,
    },
    {
      id: 'deepseek-r1',
      name: 'deepseek-r1',
      displayName: 'DeepSeek R1 (Local)',
      description: 'Razonamiento profundo ejecutado localmente sin salida a internet',
      contextWindow: 64000,
      maxOutputTokens: 8192,
      capabilities: ['text', 'reasoning'],
      isRecommended: false,
    },
    {
      id: 'qwen2.5',
      name: 'qwen2.5',
      displayName: 'Qwen 2.5 (Local)',
      description: 'Modelo multilingüe de alta precisión para tareas estructuradas',
      contextWindow: 128000,
      maxOutputTokens: 8192,
      capabilities: ['text', 'code', 'json'],
      isRecommended: false,
    },
  ],
};

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

    // Filter providers if requested
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

      if (prov.mode === AiConnectionMode.WEB_SESSION) {
        const webRes = await this.buildWebSessionResult(
          prov.key,
          true,
          prov.is_active,
          selectedModel,
        );
        results.push(webRes);
      } else {
        const apiRes = this.buildApiKeyResult(
          prov.key,
          prov.mode || AiConnectionMode.API_KEY,
          true,
          prov.is_active,
          selectedModel,
          prov.api_keys || [],
          prov.auto_rotate_api_keys ?? true,
        );
        results.push(apiRes);
      }
    }

    // If database had no providers registered at all, provide standard defaults
    if (results.length === 0) {
      if (!filterProvider || filterProvider === 'gemini') {
        if (!filterMode || filterMode === AiConnectionMode.WEB_SESSION) {
          results.push(await this.buildWebSessionResult('gemini', true, true, 'gemini-flash'));
        }
        if (!filterMode || filterMode === AiConnectionMode.API_KEY) {
          results.push(this.buildApiKeyResult('gemini', AiConnectionMode.API_KEY, false, true, 'gemini-flash', []));
        }
      }
      if (!filterProvider || filterProvider === 'mistral') {
        if (!filterMode || filterMode === AiConnectionMode.API_KEY) {
          results.push(this.buildApiKeyResult('mistral', AiConnectionMode.API_KEY, true, true, 'mistral-ocr-latest', []));
        }
      }
    }

    return results;
  }

  private async buildWebSessionResult(
    provider: string,
    isSelected: boolean,
    isActive: boolean,
    selectedModel: string | null,
  ): Promise<ProviderSelectableModelsResult> {
    const quotaData = await this.geminiService.getModelsAndQuota();

    const rawModels = quotaData?.models || [];
    const models: SelectableModelInfo[] = rawModels.map((m: any) => {
      const isCurrent = (selectedModel && selectedModel === m.id) || (!selectedModel && m.id === quotaData?.active_model);
      return {
        id: m.id,
        name: m.name,
        displayName: m.display_name || m.name,
        description: m.description || '',
        contextWindow: m.context_window || 1000000,
        capabilities: m.capabilities || ['text', 'vision', 'documents'],
        isRecommended: m.id === 'gemini-flash',
        isCurrent,
        remainingTokens: m.remaining_credits !== undefined && m.remaining_credits !== null ? `${m.remaining_credits} créditos` : 'Ilimitado / Según plan',
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
      selectedModel: selectedModel || quotaData?.active_model || 'gemini-flash',
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
    apiKeys: any[] = [],
    autoRotateApiKeys: boolean = true,
  ): ProviderSelectableModelsResult {
    const catalog = STATIC_MODELS[provider.toLowerCase()] || [
      {
        id: `${provider}-default`,
        name: `${provider}-default`,
        displayName: `${provider} Default Model`,
        description: `Modelo predeterminado para ${provider}`,
        contextWindow: 128000,
        capabilities: ['text'],
        remainingTokens: 'Según cuota de API Key',
      },
    ];

    const activeKeys = apiKeys.filter((k) => k.is_active);
    const selectedKey = activeKeys.find((k) => k.is_selected) || activeKeys[0] || null;

    const models: SelectableModelInfo[] = catalog.map((m) => {
      const isCurrent = (selectedModel && selectedModel === m.id) || (!selectedModel && m.isRecommended);
      return {
        ...m,
        isCurrent,
        remainingTokens: selectedKey?.health_state === 'cooldown'
          ? 'En enfriamiento (cuota agotada temporalmente)'
          : m.remainingTokens,
      };
    });

    return {
      provider,
      mode,
      planType: 'api_key',
      isSelected,
      isActive,
      selectedModel: selectedModel || (catalog.find((m) => m.isRecommended)?.id || catalog[0]?.id || null),
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
              cooldownUntil: selectedKey.cooldown_until ? new Date(selectedKey.cooldown_until).toISOString() : null,
              lastSuccessAt: selectedKey.last_success_at ? new Date(selectedKey.last_success_at).toISOString() : null,
              lastErrorAt: selectedKey.last_error_at ? new Date(selectedKey.last_error_at).toISOString() : null,
              lastErrorCode: selectedKey.last_error_code || null,
            }
          : null,
        keys: activeKeys.map((k) => ({
          id: k.id,
          label: k.label,
          displayHint: k.display_hint,
          healthState: k.health_state,
          isSelected: k.is_selected,
          cooldownUntil: k.cooldown_until ? new Date(k.cooldown_until).toISOString() : null,
        })),
      },
    };
  }
}
