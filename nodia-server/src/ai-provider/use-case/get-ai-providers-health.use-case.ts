import { Injectable } from '@nestjs/common';
import { AiProviderService } from '../ai-provider.service.js';
import { GeminiService } from '../../common/ai/gemini.service.js';
import {
  AiConnectionMode,
  AiKeyHealthState,
} from '../types/ai-provider.types.js';
import type { GeminiExecutionEngine } from '../../common/ai/ai.types.js';

export interface AiProviderAlert {
  id: string;
  provider: string;
  type: 'incident' | 'failover' | 'warning' | 'info';
  severity: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp?: string;
  timeAgo?: string;
  actionType: 'renew_session' | 'manage_quotas' | 'configure';
  actionLabel: string;
}

export interface AiProviderHealthItem {
  id: string;
  key: string;
  name: string;
  catalog_id?: string | null;
  catalog?: any;
  isActive: boolean;
  is_default?: boolean;
  use_api_key?: boolean;
  use_token_plan_web?: boolean;
  use_token_plan_agentic?: boolean;
  default_mode?: string | null;
  auto_rotate_api_keys?: boolean;
  mode: AiConnectionMode | null;
  status: 'healthy' | 'degraded' | 'expired' | 'unconfigured';
  statusBadge: string;
  serviceState: string;
  lastCheck: string;
  latencyMs: number;
  failoverSwitch?: string;
  assignedModels?: Record<string, string>;
  selectedModel?: string;
  availableModels?: any[];
  fields?: Record<string, any>;
  apiKeysCount?: number;
  validKeysCount?: number;
  hasConnection: boolean;
  engine?: 'agentic' | 'web';
}

export interface AiProvidersHealthResponse {
  timestamp: string;
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

function resolveGeminiHealthModels(
  provFields: any,
  defaultMode?: string,
): { selectedModel: string; availableModels: any[] } {
  const modeData = defaultMode ? provFields?.[defaultMode] : null;
  const sourceModels = modeData?.available_models?.length
    ? modeData.available_models
    : provFields?.available_models?.length
      ? provFields.available_models
      : [];

  const cleanModels = sourceModels.map((m: any) => {
    const id = m.id || m.name;
    const name = m.name || id;
    const displayName = m.display_name || m.displayName || name;
    return {
      id,
      name,
      displayName,
      description: m.description || '',
      contextWindow: m.context_window || m.contextWindow || 1000000,
      capabilities: m.capabilities || ['text', 'vision', 'documents'],
      isRecommended: Boolean(
        m.isRecommended ?? String(id).toLowerCase().includes('flash'),
      ),
      role: 'multimodal',
      remaining_credits: m.remaining_credits,
      total_credits: m.total_credits,
      usage_percentage: m.usage_percentage,
      reset_time: m.reset_time,
    };
  });

  const selectedModel =
    modeData?.selected_model ||
    provFields?.selected_model ||
    (cleanModels.length > 0 ? cleanModels[0].id : '');

  return {
    selectedModel,
    availableModels: cleanModels,
  };
}

@Injectable()
export class GetAiProvidersHealthUseCase {
  constructor(
    private readonly aiProviderService: AiProviderService,
    private readonly geminiService: GeminiService,
  ) {}

  private async checkEngineHealth(
    engine: GeminiExecutionEngine,
  ): Promise<{ isHealthy: boolean; latencyMs: number }> {
    const start = performance.now();
    let isHealthy = false;
    try {
      if (typeof this.geminiService.getDualEngineStatus === 'function') {
        const dualStatus = await this.geminiService.getDualEngineStatus();
        if (dualStatus) {
          if (engine === 'web') {
            isHealthy = Boolean(dualStatus.web?.authenticated);
          } else if (engine === 'agentic') {
            isHealthy = Boolean(dualStatus.agentic?.available);
          }
          const latencyMs = Math.round(performance.now() - start);
          return { isHealthy, latencyMs };
        }
      }

      if (typeof this.geminiService.getModelsAndQuota === 'function') {
        const authData = await this.geminiService.getModelsAndQuota(engine);
        if (engine === 'web') {
          isHealthy = Boolean(authData?.authenticated);
        } else if (engine === 'agentic') {
          isHealthy = Boolean(
            authData?.available ||
            authData?.authenticated ||
            authData?.has_active_session,
          );
        } else {
          isHealthy = Boolean(authData?.authenticated);
        }
      } else if (typeof this.geminiService.verifyProvider === 'function') {
        isHealthy = await this.geminiService.verifyProvider(engine);
      }
    } catch {
      isHealthy = false;
    }
    const latencyMs = Math.round(performance.now() - start);
    return { isHealthy, latencyMs };
  }

  async execute(): Promise<AiProvidersHealthResponse> {
    const providersResponse = await this.aiProviderService.findAllProviders({
      all: true,
      includes: true,
    });

    const providers = providersResponse.data || [];
    const alerts: AiProviderAlert[] = [];
    const providerHealthList: AiProviderHealthItem[] = [];

    let healthyCount = 0;

    for (const prov of providers) {
      const engineKey = (prov.catalog?.key || prov.key || '').toLowerCase();
      const displayName =
        prov.name ||
        prov.catalog?.name ||
        (engineKey === 'gemini'
          ? 'Google Gemini'
          : engineKey === 'mistral'
          ? 'Mistral AI'
          : engineKey === 'openai'
          ? 'OpenAI'
          : engineKey.charAt(0).toUpperCase() + engineKey.slice(1));

      const useApiKey = Boolean(
        prov.use_api_key !== undefined
          ? prov.use_api_key
          : prov.mode === AiConnectionMode.API_KEY,
      );
      const useTokenPlanWeb = Boolean(
        prov.use_token_plan_web !== undefined
          ? prov.use_token_plan_web
          : prov.mode === AiConnectionMode.WEB_SESSION,
      );
      const useTokenPlanAgentic = Boolean(
        prov.use_token_plan_agentic !== undefined
          ? prov.use_token_plan_agentic
          : prov.fields?.engine === 'agentic',
      );
      const defaultMode =
        prov.default_mode ||
        (useTokenPlanAgentic
          ? 'token_plan_agentic'
          : useTokenPlanWeb
          ? 'token_plan_web'
          : useApiKey
          ? 'api_key'
          : null);

      const hasConnection = useApiKey || useTokenPlanWeb || useTokenPlanAgentic;
      const keys = prov.api_keys || [];

      const baseInfo = {
        id: prov.id,
        key: engineKey,
        name: displayName,
        catalog_id: prov.catalog_id,
        catalog: prov.catalog,
        use_api_key: useApiKey,
        use_token_plan_web: useTokenPlanWeb,
        use_token_plan_agentic: useTokenPlanAgentic,
        default_mode: prov.default_mode || defaultMode,
        auto_rotate_api_keys: prov.auto_rotate_api_keys,
        is_default: Boolean(prov.is_default),
      };

      // 1. Inactive providers
      if (!prov.is_active) {
        providerHealthList.push({
          ...baseInfo,
          isActive: false,
          mode: prov.mode || null,
          status: 'unconfigured',
          statusBadge: 'INACTIVO',
          serviceState: 'Desactivado',
          lastCheck: 'Hoy',
          latencyMs: 0,
          selectedModel: prov.fields?.selected_model || 'none',
          availableModels: prov.fields?.available_models || [],
          hasConnection,
          engine: useTokenPlanAgentic
            ? 'agentic'
            : useTokenPlanWeb
            ? 'web'
            : prov.fields?.engine || (engineKey === 'gemini' ? 'agentic' : undefined),
        });
        continue;
      }

      // 2. Active provider with no active modes
      if (!hasConnection) {
        providerHealthList.push({
          ...baseInfo,
          isActive: true,
          mode: prov.mode || null,
          status: 'unconfigured',
          statusBadge: 'SIN CONFIGURAR',
          serviceState: 'Sin canales activos',
          lastCheck: 'Hoy',
          latencyMs: 0,
          selectedModel: 'none',
          availableModels: [],
          hasConnection: false,
        });

        alerts.push({
          id: `alert-${prov.id}-no-modes`,
          provider: engineKey,
          type: 'warning',
          severity: 'warning',
          title: `CONFIGURACIÓN INCOMPLETA: ${displayName.toUpperCase()}`,
          message:
            'El proveedor está activo pero no tiene ningún canal de conexión (API Key, Plan Web o Plan Agéntico) habilitado.',
          timestamp: new Date().toISOString(),
          timeAgo: 'Pendiente',
          actionType: 'configure',
          actionLabel: 'Configurar Proveedor',
        });
        continue;
      }

      // 3. Evaluate each enabled mode
      let agenticHealthy = false;
      let agenticLatencyMs = 0;
      if (useTokenPlanAgentic) {
        const agenticCheck = await this.checkEngineHealth('agentic');
        agenticHealthy = agenticCheck.isHealthy;
        agenticLatencyMs = agenticCheck.latencyMs;

        if (!agenticHealthy) {
          alerts.push({
            id: `alert-${prov.id}-agentic-unavailable`,
            provider: engineKey,
            type: 'incident',
            severity: 'error',
            title: `INCIDENTE ACTIVO: ${displayName.toUpperCase()} (MODO AGÉNTICO)`,
            message:
              'Entorno Antigravity no detectado o sesión inactiva. Verifique que la aplicación de Antigravity esté en ejecución.',
            timestamp: new Date().toISOString(),
            timeAgo: 'Reciente',
            actionType: 'configure',
            actionLabel: 'Verificar Entorno',
          });
        }
      }

      let webHealthy = false;
      let webLatencyMs = 0;
      if (useTokenPlanWeb) {
        const webCheck = await this.checkEngineHealth('web');
        webHealthy = webCheck.isHealthy;
        webLatencyMs = webCheck.latencyMs;

        if (!webHealthy) {
          alerts.push({
            id: `alert-${prov.id}-web-expired`,
            provider: engineKey,
            type: 'incident',
            severity: 'error',
            title: `INCIDENTE ACTIVO: ${displayName.toUpperCase()} (SESIÓN WEB)`,
            message:
              'Sesión web remota caducada o no autenticada (401 Unauthorized). Requiere renovar sesión de Google.',
            timestamp: new Date().toISOString(),
            timeAgo: 'Reciente',
            actionType: 'renew_session',
            actionLabel: 'Renovar Sesión Ahora',
          });
        }
      }

      const activeKeys = keys.filter((k: any) => k.is_active);
      const validKeys = activeKeys.filter(
        (k: any) =>
          k.health_state === AiKeyHealthState.VALID ||
          k.health_state === AiKeyHealthState.UNTESTED,
      );
      const cooldownKeys = activeKeys.filter(
        (k: any) => k.health_state === AiKeyHealthState.COOLDOWN,
      );

      const hasKeysIncident =
        activeKeys.length > 0 && validKeys.length === 0 && cooldownKeys.length > 0;
      const hasFailover = cooldownKeys.length > 0 && validKeys.length > 0;

      if (useApiKey) {
        if (activeKeys.length === 0) {
          alerts.push({
            id: `alert-${prov.id}-no-keys`,
            provider: engineKey,
            type: 'warning',
            severity: 'warning',
            title: `CONFIGURACIÓN INCOMPLETA: ${displayName.toUpperCase()} (API KEY)`,
            message:
              'No hay llaves de API activas registradas para este proveedor.',
            timestamp: new Date().toISOString(),
            timeAgo: 'Pendiente',
            actionType: 'configure',
            actionLabel: 'Añadir API Key',
          });
        } else if (hasKeysIncident) {
          alerts.push({
            id: `alert-${prov.id}-keys-exhausted`,
            provider: engineKey,
            type: 'incident',
            severity: 'error',
            title: `INCIDENTE ACTIVO: ${displayName.toUpperCase()} (API KEYS)`,
            message:
              'Todas las llaves de API activas están en periodo de enfriamiento o agotadas.',
            timestamp: new Date().toISOString(),
            timeAgo: 'Reciente',
            actionType: 'manage_quotas',
            actionLabel: 'Gestionar Cuotas',
          });
        } else if (hasFailover) {
          alerts.push({
            id: `alert-${prov.id}-failover`,
            provider: engineKey,
            type: 'failover',
            severity: 'info',
            title: `FAILOVER OPERATIVO: ${displayName.toUpperCase()}`,
            message:
              'Una o más llaves están en enfriamiento. Tráfico enrutado a llave activa de respaldo.',
            timestamp: new Date().toISOString(),
            timeAgo: 'En curso',
            actionType: 'manage_quotas',
            actionLabel: 'Gestionar Cuotas',
          });
        }
      }

      // Count enabled vs healthy vs failed modes
      const totalEnabled =
        Number(useTokenPlanAgentic) +
        Number(useTokenPlanWeb) +
        Number(useApiKey);

      const totalHealthy =
        (useTokenPlanAgentic && agenticHealthy ? 1 : 0) +
        (useTokenPlanWeb && webHealthy ? 1 : 0) +
        (useApiKey && validKeys.length > 0 ? 1 : 0);

      const totalFailed =
        (useTokenPlanAgentic && !agenticHealthy ? 1 : 0) +
        (useTokenPlanWeb && !webHealthy ? 1 : 0) +
        (useApiKey && (activeKeys.length === 0 || hasKeysIncident) ? 1 : 0);

      let status: 'healthy' | 'degraded' | 'expired' | 'unconfigured' = 'healthy';
      let statusBadge = 'DISPONIBLE';
      let serviceState = 'Disponible';

      if (totalHealthy === totalEnabled) {
        status = 'healthy';
        statusBadge = 'DISPONIBLE';
        if (useTokenPlanAgentic && useTokenPlanWeb) {
          serviceState = 'Dual Engine Operativo (Agentic & Web)';
        } else if (useTokenPlanAgentic) {
          serviceState = 'Modo Agéntico Disponible';
        } else if (useTokenPlanWeb) {
          serviceState = 'Sesión Web Disponible';
        } else {
          serviceState = `${validKeys.length}/${activeKeys.length} Keys Válidas`;
        }
        healthyCount++;
      } else if (totalHealthy > 0 && totalFailed > 0) {
        status = 'degraded';
        statusBadge = 'DEGRADADO';
        if (useTokenPlanWeb && !webHealthy && useTokenPlanAgentic && agenticHealthy) {
          serviceState = 'Sesión Web inactiva (Agentic operativo)';
        } else if (useTokenPlanAgentic && !agenticHealthy && useTokenPlanWeb && webHealthy) {
          serviceState = 'Agentic inactivo (Sesión Web operativa)';
        } else if (hasFailover) {
          serviceState = 'Failover activo de llaves';
        } else {
          serviceState = 'Parcialmente operativo';
        }
      } else {
        // totalHealthy === 0
        if (useApiKey && !useTokenPlanWeb && !useTokenPlanAgentic && activeKeys.length === 0) {
          status = 'unconfigured';
          statusBadge = 'SIN CONFIGURAR';
          serviceState = 'Sin llaves API registradas';
        } else {
          status = 'expired';
          statusBadge =
            useTokenPlanWeb && !useTokenPlanAgentic && !useApiKey
              ? 'REQUIERE INICIAR SESIÓN'
              : 'INCIDENTE ACTIVO';
          serviceState =
            useTokenPlanWeb && !useTokenPlanAgentic && !useApiKey
              ? 'Caducado (401)'
              : 'Sin canales operativos';
        }
      }

      const modeData = prov.fields?.[defaultMode] || {};
      const { selectedModel, availableModels } =
        engineKey === 'gemini'
          ? resolveGeminiHealthModels(prov.fields, defaultMode)
          : {
              selectedModel:
                modeData.selected_model ||
                prov.fields?.selected_model ||
                prov.fields?.chat_model ||
                prov.fields?.model ||
                '',
              availableModels:
                modeData.available_models || prov.fields?.available_models || [],
            };

      const fallbackKeyHint =
        activeKeys.find((k: any) => k.health_state === AiKeyHealthState.VALID)
          ?.label || 'key-sec';

      const latencies = [
        useTokenPlanAgentic ? agenticLatencyMs : 0,
        useTokenPlanWeb ? webLatencyMs : 0,
        useApiKey ? 185 : 0,
      ].filter((l) => l > 0);
      const latencyMs =
        latencies.length > 0
          ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
          : 0;

      providerHealthList.push({
        ...baseInfo,
        isActive: prov.is_active,
        mode: (defaultMode as AiConnectionMode) || prov.mode || null,
        status,
        statusBadge,
        serviceState,
        lastCheck: 'Hace 1 min',
        latencyMs,
        failoverSwitch: useApiKey
          ? prov.auto_rotate_api_keys
            ? `Activo (Failover a ${fallbackKeyHint})`
            : 'Desactivado'
          : undefined,
        assignedModels: {
          ocr: prov.fields?.ocr_model || undefined,
          infer: selectedModel,
        },
        selectedModel,
        availableModels,
        fields: prov.fields || {},
        apiKeysCount: keys.length,
        validKeysCount: validKeys.length,
        hasConnection: true,
        engine: useTokenPlanAgentic
          ? 'agentic'
          : useTokenPlanWeb
          ? 'web'
          : prov.fields?.engine || (engineKey === 'gemini' ? 'agentic' : undefined),
      });
    }

    const hasIncidents = alerts.some((a) => a.severity === 'error');
    const hasWarnings = alerts.some((a) => a.severity === 'warning');

    const overallStatus: 'healthy' | 'degraded' | 'incident' = hasIncidents
      ? 'incident'
      : hasWarnings
      ? 'degraded'
      : 'healthy';

    const activeCount = providers.filter((p) => p.is_active).length;

    return {
      timestamp: new Date().toISOString(),
      overallStatus,
      alerts,
      providers: providerHealthList,
      summary: {
        totalProviders: providers.length,
        activeProviders: activeCount,
        healthyProviders: healthyCount,
        incidentsCount: alerts.length,
      },
    };
  }
}
