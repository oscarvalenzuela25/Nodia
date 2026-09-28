import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AiProviderService } from '../ai-provider.service.js';
import { GeminiService } from '../../common/ai/gemini.service.js';
import { AiConnectionMode } from '../types/ai-provider.types.js';

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
    options?: { persist?: boolean },
  ): Promise<SyncModelsResult> {
    const shouldPersist = options?.persist ?? true;
    const provider = await this.aiProviderService.findProviderById(providerId);
    if (!provider) {
      throw new NotFoundException(`AiProvider with ID "${providerId}" not found`);
    }

    const engineKey = (provider.catalog?.key || provider.key || '').toLowerCase();
    const currentSelectedModel = provider.fields?.selected_model || null;

    let discoveredModels: DiscoveredModelInfo[] = [];
    let tokenPlan: SyncModelsResult['tokenPlan'] = null;

    if (engineKey === 'gemini' || provider.mode === AiConnectionMode.WEB_SESSION) {
      const quotaData = await this.geminiService.getModelsAndQuota();

      if (!quotaData || !quotaData.authenticated) {
        throw new BadRequestException(
          'La sesión web de Gemini no está activa o no ha sido autenticada en el microservicio.',
        );
      }

      tokenPlan = {
        tier: quotaData.tier || 'UNKNOWN',
        planLabel: quotaData.plan_label || 'Plan Web',
        authenticated: Boolean(quotaData.authenticated),
      };

      const rawModels = quotaData.models || [];
      discoveredModels = rawModels.map((m: any) => {
        const id = m.id || m.name;
        const name = m.name || id;
        const displayName = m.display_name || name;
        const description = m.description || `Modelo ${displayName} en Gemini Web`;
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
          isRecommended: String(id).toLowerCase().includes('flash'),
          role: 'multimodal' as const,
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
      // Persist discovered models into provider fields in database
      const updatedFields = {
        ...(provider.fields || {}),
        available_models: discoveredModels,
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

    // 4. REST standard models endpoints (OpenAI, Mistral, DeepSeek, Groq, Perplexity, xAI, Together, etc.)
    let endpoint = 'https://api.openai.com/v1/models';
    if (baseUrl) {
      endpoint = baseUrl.endsWith('/models')
        ? baseUrl
        : `${baseUrl.replace(/\/+$/, '')}/v1/models`;
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
            contextWindow:
              lower.includes('o1') || lower.includes('o3') ? 200000 : 128000,
            capabilities: caps,
            isRecommended:
              lower === 'gpt-4o' ||
              lower === 'mistral-large-latest' ||
              lower === 'deepseek-chat',
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
