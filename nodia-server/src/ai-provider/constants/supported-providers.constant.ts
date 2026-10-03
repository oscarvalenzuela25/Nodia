import { AiConnectionMode } from '../types/ai-provider.types.js';
import {
  InternalMicroserviceKey,
  GeminiEnginePlan,
} from '../../common/constants/internal-microservices.constant.js';

export interface SupportedModelDef {
  id: string;
  name: string;
  displayName?: string;
  description: string;
  contextWindow?: number;
  capabilities: string[];
  isRecommended?: boolean;
  role?: 'chat' | 'multimodal' | 'ocr';
}

export interface SupportedProviderDef {
  key: string;
  name: string;
  description: string;
  defaultMode: AiConnectionMode;
  supportedModes: AiConnectionMode[];
  microserviceKey?: InternalMicroserviceKey;
  supportedEngines?: GeminiEnginePlan[];
  defaultEngine?: GeminiEnginePlan;
  defaultSelectedModel?: string;
  defaultOcrModel?: string;
  availableModels?: SupportedModelDef[];
}

export const SUPPORTED_AI_PROVIDERS: SupportedProviderDef[] = [
  {
    key: InternalMicroserviceKey.GEMINI,
    name: 'Google Gemini',
    description:
      'Modelos multimodales de Google con soporte para visión, documentos y razonamiento rápido',
    defaultMode: AiConnectionMode.WEB_SESSION,
    supportedModes: [AiConnectionMode.WEB_SESSION, AiConnectionMode.API_KEY],
    microserviceKey: InternalMicroserviceKey.GEMINI,
    supportedEngines: [GeminiEnginePlan.AGENTIC, GeminiEnginePlan.WEB],
    defaultEngine: GeminiEnginePlan.AGENTIC,
  },
  {
    key: 'openai',
    name: 'OpenAI',
    description:
      'Modelos GPT de propósito general para extracción y razonamiento multimodal de frontera',
    defaultMode: AiConnectionMode.API_KEY,
    supportedModes: [AiConnectionMode.API_KEY],
  },
  {
    key: 'anthropic',
    name: 'Anthropic Claude',
    description:
      'Modelos Claude con capacidades de razonamiento híbrido, visión y alta precisión analítica',
    defaultMode: AiConnectionMode.API_KEY,
    supportedModes: [AiConnectionMode.API_KEY],
  },
  {
    key: 'deepseek',
    name: 'DeepSeek',
    description:
      'Modelos abiertos de razonamiento profundo y arquitectura MoE con excelente relación costo-efectividad',
    defaultMode: AiConnectionMode.API_KEY,
    supportedModes: [AiConnectionMode.API_KEY],
  },
  {
    key: 'mistral',
    name: 'Mistral AI',
    description:
      'Modelos de frontera de Mistral especializados en OCR de documentos y razonamiento estructurado',
    defaultMode: AiConnectionMode.API_KEY,
    supportedModes: [AiConnectionMode.API_KEY],
  },
  {
    key: 'xai',
    name: 'xAI (Grok)',
    description:
      'Modelos Grok de xAI con comprensión multimodal y razonamiento en tiempo real',
    defaultMode: AiConnectionMode.API_KEY,
    supportedModes: [AiConnectionMode.API_KEY],
  },
  {
    key: 'groq',
    name: 'Groq LPU',
    description:
      'Motor de inferencia ultra rápido en hardware LPU para latencias mínimas',
    defaultMode: AiConnectionMode.API_KEY,
    supportedModes: [AiConnectionMode.API_KEY],
  },
  {
    key: 'cohere',
    name: 'Cohere',
    description:
      'Modelos de lenguaje empresarial orientados a RAG, generación y extracción estructurada',
    defaultMode: AiConnectionMode.API_KEY,
    supportedModes: [AiConnectionMode.API_KEY],
  },
  {
    key: 'perplexity',
    name: 'Perplexity AI',
    description:
      'Modelos con capacidad de búsqueda web y verificación de hechos en tiempo real',
    defaultMode: AiConnectionMode.API_KEY,
    supportedModes: [AiConnectionMode.API_KEY],
  },
  {
    key: 'openrouter',
    name: 'OpenRouter',
    description:
      'Enrutador unificado multi-proveedor con acceso global a cientos de modelos y failover dinámico',
    defaultMode: AiConnectionMode.API_KEY,
    supportedModes: [AiConnectionMode.API_KEY],
  },
  {
    key: 'together',
    name: 'Together AI',
    description:
      'Inferencia de modelos de código abierto a gran escala en infraestructura en la nube',
    defaultMode: AiConnectionMode.API_KEY,
    supportedModes: [AiConnectionMode.API_KEY],
  },
  {
    key: 'ollama',
    name: 'Ollama (Local)',
    description:
      'Ejecución y hosting de modelos LLM locales en servidores on-premise o desarrollo',
    defaultMode: AiConnectionMode.API_KEY,
    supportedModes: [AiConnectionMode.API_KEY],
  },
];
