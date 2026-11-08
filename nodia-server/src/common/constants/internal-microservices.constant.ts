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

/** Agentic runtime metadata is descriptive; quotas and availability require observation. */
export enum GeminiEnginePlan {
  AGENTIC = 'agentic',
}
export type GeminiExecutionEngine = 'agentic';
export interface GeminiEnginePlanDef {
  key: GeminiEnginePlan;
  planId: 'agentic';
  name: string;
  description: string;
  quotaSource: string;
  requiresApiKey: false;
}
export const GEMINI_ENGINE_PLANS: Record<
  GeminiEnginePlan,
  GeminiEnginePlanDef
> = {
  [GeminiEnginePlan.AGENTIC]: {
    key: GeminiEnginePlan.AGENTIC,
    planId: 'agentic',
    name: 'Agentic',
    description:
      'Runtime Agentic con autenticacion y descubrimiento comprobados por sesion.',
    quotaSource:
      'Observacion real del proveedor; desconocida si no se entrega.',
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
    supportedEngines: [GeminiEnginePlan.AGENTIC],
    defaultEngine: GeminiEnginePlan.AGENTIC,
  },
};

/**
 * Lista de microservicios internos registrados en el servidor.
 */
export const REGISTERED_INTERNAL_MICROSERVICES: InternalMicroserviceDef[] =
  Object.values(INTERNAL_MICROSERVICES);

/**
 * Validador para determinar si una clave corresponde a un microservicio interno registrado.
 */
export function isInternalMicroservice(
  key: string,
): key is InternalMicroserviceKey {
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
