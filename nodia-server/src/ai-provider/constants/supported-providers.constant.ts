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
      'Gemini API, sesión Web y Antigravity. El catálogo define modos configurables; disponibilidad y modelos se comprueban por canal.',
    defaultMode: AiConnectionMode.WEB_SESSION,
    supportedModes: [AiConnectionMode.WEB_SESSION, AiConnectionMode.API_KEY],
    microserviceKey: InternalMicroserviceKey.GEMINI,
    supportedEngines: [GeminiEnginePlan.AGENTIC, GeminiEnginePlan.WEB],
    defaultEngine: GeminiEnginePlan.WEB,
  },
  {
    key: 'openai', name: 'OpenAI', description: 'Conexión mediante API key y modelos descubiertos de la cuenta.',
    defaultMode: AiConnectionMode.API_KEY, supportedModes: [AiConnectionMode.API_KEY],
  },
];
