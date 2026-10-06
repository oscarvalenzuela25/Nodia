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
      'Conexiones de sesión Gemini Web y Antigravity; el estado y las capacidades se consultan al servicio.',
    defaultMode: AiConnectionMode.WEB_SESSION,
    supportedModes: [AiConnectionMode.WEB_SESSION],
    microserviceKey: InternalMicroserviceKey.GEMINI,
    supportedEngines: [GeminiEnginePlan.AGENTIC, GeminiEnginePlan.WEB],
    defaultEngine: GeminiEnginePlan.WEB,
  },
];
