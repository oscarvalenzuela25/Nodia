import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AiProviderService } from '../ai-provider.service.js';
import { GeminiService } from '../../common/ai/gemini.service.js';
import { AiConnectionMode } from '../types/ai-provider.types.js';
import type { GeminiExecutionEngine } from '../../common/ai/ai.types.js';

export interface DiscoveredModelInfo {
  id: string;
  name: string;
  displayName: string;
  description: string;
  contextWindow: number;
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
      throw new NotFoundException(`AiProvider with ID "${providerId}" not found`);
    }

    const engineKey = (provider.catalog?.key || provider.key || '').toLowerCase();
    const targetMode =
      options?.mode ||
      provider.default_mode ||
      provider.mode ||
      'api_key';

    const targetEngine: GeminiExecutionEngine | undefined =
      options?.engine ||
      (targetMode === 'token_plan_agentic'
        ? 'agentic'
        : targetMode === 'token_plan_web'
          ? 'web'
          : (provider.fields?.engine as GeminiExecutionEngine) || undefined);

    const modeFields = (provider.fields?.[targetMode] as Record<string, any>) || {};
    const hasAnyModeScoped =
      Boolean(provider.fields?.token_plan_agentic) ||
      Boolean(provider.fields?.token_plan_web) ||
      Boolean(provider.fields?.api_key);

    const currentSelectedModel =
      modeFields.selected_model ||
      ((targetMode === provider.default_mode || !hasAnyModeScoped)
        ? provider.fields?.selected_model
        : null) ||
      null;

    let discoveredModels: DiscoveredModelInfo[] = [];
    let tokenPlan: SyncModelsResult['tokenPlan'] = null;

    if (
      (engineKey === 'gemini' && targetMode !== 'api_key') ||
      targetMode === 'token_plan_web' ||
      targetMode === 'token_plan_agentic'
    ) {
      const quotaData = await this.geminiService.getModelsAndQuota(targetEngine);

      if (!quotaData || !quotaData.authenticated) {
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
          (targetEngine === 'agentic' ? 'Token Plan (Agentic)' : 'Token Plan (Web)'),
        authenticated: Boolean(quotaData.authenticated),
      };

      const rawModels = quotaData.models || [];
      discoveredModels = rawModels.map((m: any) => {
        const id = m.id || m.name;
        const name = m.name || id;
        const displayName = m.display_name || name;
        const description =
          m.description ||
          `Modelo ${displayName} en ${targetEngine === 'agentic' ? 'Antigravity Agentic' : 'Gemini Web'}`;
        const capabilities = Array.isArray(m.capabilities)
          ? m.capabilities
          : ['text', 'vision', 'documents'];

        return {
          id,
          name,
          displayName,
          description,
          contextWindow: m.context_window || 1000000,
          capabilities,
          isRecommended: Boolean(m.isRecommended ?? String(id).toLowerCase().includes('flash')),
          role: (m.role || (capabilities.includes('ocr') ? 'ocr' : 'multimodal')) as any,
        };
      });
    } else {
      // API Key mode: Retrieve real live models from the provider's API
      const apiKeySecret = await this.aiProviderService.getActiveApiKeySecret(provider.id);
      if (!apiKeySecret) {
        throw new BadRequestException(
          `El proveedor "${provider.name || provider.key}" no tiene ninguna API Key activa para consultar sus modelos en tiempo real. Por favor añade una API Key primero.`,
        );
      }

      discoveredModels = await this.fetchLiveModelsFromProvider(
        engineKey,
        apiKeySecret,
        provider.fields?.base_url,
      );
    }

    if (discoveredModels.length === 0) {
      throw new BadRequestException(
        `No se encontraron modelos disponibles para el proveedor "${provider.name || provider.key}".`,
      );
    }

    if (shouldPersist) {
      // Persist discovered models into provider fields in database scoped to the mode
      const isDefaultMode =
        !provider.default_mode || targetMode === provider.default_mode;
      const updatedFields = {
        ...(provider.fields || {}),
        [targetMode]: {
          ...modeFields,
          available_models: discoveredModels,
        },
        ...(isDefaultMode ? { available_models: discoveredModels } : {}),
      };
      await this.aiProviderService.updateProviderFields(provider.id, updatedFields);
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

  private async fetchLiveModelsFromProvider(
    engineKey: string,
    apiKey: string,
    baseUrl?: string,
  ): Promise<DiscoveredModelInfo[]> {
    const normalizedKey = engineKey.toLowerCase().trim();

    // 1. ANTHROPIC
    if (normalizedKey === 'anthropic' || normalizedKey.includes('claude')) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new BadRequestException(`Anthropic API error (${res.status}): ${errText}`);
        }
        const data: any = await res.json();
        const list = Array.isArray(data.data) ? data.data : [];
        return list.map((m: any) => ({
          id: m.id,
          name: m.display_name || m.id,
          displayName: m.display_name || m.id,
          description: `Modelo Anthropic ${m.display_name || m.id}`,
          contextWindow: 200000,
          capabilities: ['text', 'vision', 'reasoning'],
          isRecommended: String(m.id).includes('sonnet'),
          role: 'multimodal' as const,
        }));
      } catch (err: any) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException(`Error de conexión con Anthropic: ${err.message}`);
      }
    }

    // 2. COHERE
    if (normalizedKey === 'cohere') {
      try {
        const res = await fetch('https://api.cohere.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new BadRequestException(`Cohere API error (${res.status}): ${errText}`);
        }
        const data: any = await res.json();
        const list = Array.isArray(data.models) ? data.models : [];
        return list.map((m: any) => ({
          id: m.name,
          name: m.name,
          displayName: m.name,
          description: `Modelo Cohere ${m.name}`,
          contextWindow: m.context_length || 128000,
          capabilities: ['text'],
          isRecommended: String(m.name).includes('command-r-plus'),
          role: 'chat' as const,
        }));
      } catch (err: any) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException(`Error de conexión con Cohere: ${err.message}`);
      }
    }

    // 3. OLLAMA
    if (normalizedKey === 'ollama') {
      try {
        const host = baseUrl || 'http://localhost:11434';
        const res = await fetch(`${host.replace(/\/+$/, '')}/api/tags`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
          throw new BadRequestException(`Ollama host error (${res.status})`);
        }
        const data: any = await res.json();
        const list = Array.isArray(data.models) ? data.models : [];
        return list.map((m: any) => ({
          id: m.name,
          name: m.name,
          displayName: m.name,
          description: `Modelo local Ollama ${m.name}`,
          contextWindow: 32000,
          capabilities: ['text'],
          isRecommended: false,
          role: 'chat' as const,
        }));
      } catch (err: any) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException(`Error de conexión con Ollama: ${err.message}`);
      }
    }

    // 4. GEMINI / GOOGLE
    if (normalizedKey === 'gemini' || normalizedKey === 'google') {
      try {
        const url = baseUrl
          ? (baseUrl.endsWith('/models')
              ? baseUrl
              : `${baseUrl.replace(/\/+$/, '')}/models?key=${encodeURIComponent(apiKey)}`)
          : `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;

        const res = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          // Fallback to OpenAI-compatible endpoint if native fails
          const openaiUrl = baseUrl
            ? (baseUrl.endsWith('/models')
                ? baseUrl
                : `${baseUrl.replace(/\/+$/, '')}/v1/models`)
            : 'https://generativelanguage.googleapis.com/v1beta/openai/models';

          const openaiRes = await fetch(openaiUrl, {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'x-goog-api-key': apiKey,
            },
            signal: AbortSignal.timeout(10000),
          }).catch(() => null);

          if (openaiRes && openaiRes.ok) {
            const openAiData: any = await openaiRes.json();
            const list = Array.isArray(openAiData.data)
              ? openAiData.data
              : Array.isArray(openAiData.models)
                ? openAiData.models
                : [];
            return list.map((m: any) => {
              const rawId = String(m.id || m.name || '');
              const id = rawId.replace(/^models\//, '');
              const lower = id.toLowerCase();
              return {
                id,
                name: id,
                displayName: id,
                description: `Modelo Google Gemini ${id}`,
                contextWindow: 1000000,
                capabilities: ['text', 'vision', 'documents', 'ocr'],
                isRecommended: lower.includes('flash'),
                role: 'multimodal' as const,
              };
            });
          }

          const errText = await res.text();
          throw new BadRequestException(
            `Error al consultar API de Gemini (${res.status}): ${errText}`,
          );
        }

        const data: any = await res.json();
        const list = Array.isArray(data.models)
          ? data.models
          : Array.isArray(data.data)
            ? data.data
            : [];

        return list
          .filter((m: any) => {
            const methods = Array.isArray(m.supportedGenerationMethods)
              ? m.supportedGenerationMethods
              : [];
            return methods.length === 0 || methods.includes('generateContent');
          })
          .map((m: any) => {
            const rawId = String(m.name || m.id || '');
            const id = rawId.replace(/^models\//, '');
            const displayName = m.displayName || id;
            const lower = id.toLowerCase();
            const caps = ['text', 'vision', 'documents', 'ocr'];
            if (lower.includes('thinking') || lower.includes('2.5') || lower.includes('pro')) {
              caps.push('reasoning');
            }

            return {
              id,
              name: id,
              displayName,
              description: m.description || `Modelo Google Gemini ${displayName}`,
              contextWindow: m.inputTokenLimit || 1000000,
              capabilities: caps,
              isRecommended: lower.includes('flash'),
              role: 'multimodal' as const,
            };
          });
      } catch (err: any) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException(`Error de conexión con Google Gemini: ${err.message}`);
      }
    }

    // 5. REST standard models endpoints (OpenAI, Mistral, DeepSeek, Groq, Perplexity, xAI, Together, etc.)
    let endpoint = '';
    if (baseUrl) {
      endpoint = baseUrl.endsWith('/models')
        ? baseUrl
        : `${baseUrl.replace(/\/+$/, '')}/v1/models`;
    } else if (normalizedKey === 'openai') {
      endpoint = 'https://api.openai.com/v1/models';
    } else if (normalizedKey === 'mistral') {
      endpoint = 'https://api.mistral.ai/v1/models';
    } else if (normalizedKey === 'deepseek') {
      endpoint = 'https://api.deepseek.com/models';
    } else if (normalizedKey === 'groq') {
      endpoint = 'https://api.groq.com/openai/v1/models';
    } else if (normalizedKey === 'perplexity') {
      endpoint = 'https://api.perplexity.ai/models';
    } else if (normalizedKey === 'xai') {
      endpoint = 'https://api.x.ai/v1/models';
    } else if (normalizedKey === 'together') {
      endpoint = 'https://api.together.xyz/v1/models';
    } else {
      throw new BadRequestException(
        `El proveedor "${engineKey}" no tiene un endpoint de modelos configurado por defecto. Por favor especifique una URL base (Base URL) compatible en la configuración del proveedor.`,
      );
    }

    try {
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new BadRequestException(
          `Error al consultar API de ${engineKey} (${res.status}): ${errText}`,
        );
      }

      const data: any = await res.json();
      const list = Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.models)
        ? data.models
        : [];

      return list
        .filter((m: any) => {
          const id = String(m.id || m.name || '').toLowerCase();
          if (normalizedKey === 'openai') {
            if (
              id.includes('embedding') ||
              id.includes('tts') ||
              id.includes('whisper') ||
              id.includes('babbage') ||
              id.includes('davinci') ||
              id.includes('moderation') ||
              id.includes('dall-e')
            ) {
              return false;
            }
          }
          return Boolean(id);
        })
        .map((m: any) => {
          const id = String(m.id || m.name);
          const lower = id.toLowerCase();
          const caps = ['text'];
          if (
            lower.includes('vision') ||
            lower.includes('4o') ||
            lower.includes('pixtral') ||
            lower.includes('gemini')
          ) {
            caps.push('vision');
          }
          if (lower.includes('ocr') || lower.includes('document')) {
            caps.push('ocr');
          }
          if (
            lower.includes('o1') ||
            lower.includes('o3') ||
            lower.includes('reason') ||
            lower.includes('r1') ||
            lower.includes('thinking')
          ) {
            caps.push('reasoning');
          }

          const isOcr = caps.includes('ocr');
          const isMultimodal = caps.includes('vision');

          return {
            id,
            name: id,
            displayName: id,
            description: `Modelo ${id} obtenido en tiempo real`,
            contextWindow: 128000,
            capabilities: caps,
            isRecommended:
              lower.includes('latest') ||
              lower.includes('default') ||
              lower.includes('recommended'),
            role: isOcr ? ('ocr' as const) : isMultimodal ? ('multimodal' as const) : ('chat' as const),
          };
        });
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        `Error al obtener modelos desde ${endpoint}: ${err.message}`,
      );
    }
  }
}
