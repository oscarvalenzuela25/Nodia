/**
 * Claves canónicas de los microservicios internos del ecosistema Nodia (ADR-008).
 * Cada microservicio opera en red privada, es consumido exclusivamente por Nodia Server
 * y se autentica mediante una credencial exclusiva de 32 bytes (64 caracteres hex).
 */
export enum InternalMicroserviceKey {
  GEMINI = 'gemini',
  // Futuros microservicios internos:
  // REPORTS = 'reports',
  // TRANSCRIPTION = 'transcription',
}

/**
 * Motores de ejecución y planes de cuota soportados por el microservicio Gemini.
 * Ambos operan bajo la suscripción Google One AI Premium ($20 USD/mes), con CERO API Keys.
 */
export enum GeminiEnginePlan {
  AGENTIC = 'agentic', // Token Plan Agéntico: Antigravity SDK con sesión local (cuota 5h / 1 sem)
  WEB = 'web',         // Token Plan Web: gemini_webapi con cookies de sesión (cuota 2400 créditos)
}

export type GeminiExecutionEngine = 'agentic' | 'web';

/**
 * Metadata descriptiva de cada motor/plan de cuota de IA.
 */
export interface GeminiEnginePlanDef {
  key: GeminiEnginePlan;
  planId: 'token_plan_agentic' | 'token_plan_web';
  name: string;
  description: string;
  quotaSource: string;
  requiresApiKey: false;
}

export const GEMINI_ENGINE_PLANS: Record<GeminiEnginePlan, GeminiEnginePlanDef> = {
  [GeminiEnginePlan.AGENTIC]: {
    key: GeminiEnginePlan.AGENTIC,
    planId: 'token_plan_agentic',
    name: 'Token Plan Agéntico (Antigravity)',
    description:
      'Motor agéntico local basado en el SDK google-antigravity con OCR multimodal nativo y tokens de razonamiento extendido.',
    quotaSource: 'Cuota agéntica local (límites de 5 horas y 1 semana de Google One AI Premium)',
    requiresApiKey: false,
  },
  [GeminiEnginePlan.WEB]: {
    key: GeminiEnginePlan.WEB,
    planId: 'token_plan_web',
    name: 'Token Plan Web (Cookies)',
    description:
      'Motor web basado en cookies autenticadas de navegador (__Secure-1PSID / TS) y persistencia en sesión.',
    quotaSource: 'Cuota web de gemini.google.com (2400 créditos/peticiones por ventana de reseteo)',
    requiresApiKey: false,
  },
};

/**
 * Definición técnica y de red de un microservicio interno.
 */
export interface InternalMicroserviceDef {
  key: InternalMicroserviceKey;
  name: string;
  description: string;
  envUrlKey: string;
  envTokenKey: string;
  serviceHeader: 'X-Nodia-Service-Token';
  supportedEngines: GeminiEnginePlan[];
  defaultEngine: GeminiEnginePlan;
}

export const INTERNAL_MICROSERVICES: Record<
  InternalMicroserviceKey,
  InternalMicroserviceDef
> = {
  [InternalMicroserviceKey.GEMINI]: {
    key: InternalMicroserviceKey.GEMINI,
    name: 'Nodia Gemini Microservice',
    description:
      'Microservicio FastAPI para procesamiento multimodal de facturas con motores Agéntico y Web (ADR-007, ADR-008)',
    envUrlKey: 'GEMINI_MICROSERVICE_URL',
    envTokenKey: 'GEMINI_SERVICE_TOKEN',
    serviceHeader: 'X-Nodia-Service-Token',
    supportedEngines: [GeminiEnginePlan.AGENTIC, GeminiEnginePlan.WEB],
    defaultEngine: GeminiEnginePlan.AGENTIC,
  },
};

/**
 * Lista de microservicios internos registrados en el servidor.
 */
export const REGISTERED_INTERNAL_MICROSERVICES: InternalMicroserviceDef[] = Object.values(
  INTERNAL_MICROSERVICES,
);

/**
 * Validador para determinar si una clave corresponde a un microservicio interno registrado.
 */
export function isInternalMicroservice(key: string): key is InternalMicroserviceKey {
  return Object.values(InternalMicroserviceKey).includes(
    key as InternalMicroserviceKey,
  );
}

/**
 * Obtiene la definición de un microservicio interno por su clave.
 */
export function getInternalMicroservice(
  key: string,
): InternalMicroserviceDef | undefined {
  if (isInternalMicroservice(key)) {
    return INTERNAL_MICROSERVICES[key];
  }
  return undefined;
}
