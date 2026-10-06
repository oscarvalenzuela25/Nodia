import { Injectable } from '@nestjs/common';
import { AiProviderService } from '../ai-provider.service.js';
import { GeminiService } from '../../common/ai/gemini.service.js';
import { AiConnectionMode } from '../types/ai-provider.types.js';
import type { GeminiExecutionEngine } from '../../common/ai/ai.types.js';
import { isAgenticSessionActive } from '../../common/ai/gemini-engine-status.js';
import { configuredModelFields } from '../helpers/model-observation.helper.js';

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
  lastCheck: string | null;
  latencyMs: number | null;
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

@Injectable()
export class GetAiProvidersHealthUseCase {
  constructor(private readonly aiProviderService: AiProviderService, private readonly geminiService: GeminiService) {}

  private async checkEngineHealth(engine: GeminiExecutionEngine) {
    const started = performance.now();
    try {
      if (typeof this.geminiService.getDualEngineStatus === 'function') {
        const status = await this.geminiService.getDualEngineStatus();
        if (!status) return { healthy: null, latency: null };
        return { healthy: engine === 'agentic' ? isAgenticSessionActive(status.agentic)
          : status.web?.authenticated === true && status.web?.available !== false,
          latency: Math.round(performance.now() - started) };
      }
      const status = await this.geminiService.getModelsAndQuota(engine);
      if (typeof status?.authenticated !== 'boolean') return { healthy: null, latency: null };
      return { healthy: engine === 'agentic' ? isAgenticSessionActive(status) : status.authenticated === true,
        latency: Math.round(performance.now() - started) };
    } catch { return { healthy: null, latency: null }; }
  }

  async execute(): Promise<AiProvidersHealthResponse> {
    const response = await this.aiProviderService.findAllProviders({ all: true, includes: true });
    const providers = response.data ?? [];
    const alerts: AiProviderAlert[] = [];
    const health: AiProviderHealthItem[] = [];
    for (const provider of providers) {
      const key = (provider.catalog?.key ?? provider.key ?? '').toLowerCase();
      const name = provider.name || provider.catalog?.name || key;
      const web = provider.use_token_plan_web ?? (provider.mode === 'web_session' || provider.mode === 'token_plan_web');
      const agentic = provider.use_token_plan_agentic ?? provider.mode === 'token_plan_agentic';
      const defaultMode = provider.default_mode ?? (agentic ? 'token_plan_agentic' : web ? 'token_plan_web' : provider.mode);
      const fields = configuredModelFields(provider.fields ?? {});
      const hasScoped = Boolean(fields.token_plan_web || fields.token_plan_agentic || fields.api_key);
      const modelFields = (fields[defaultMode ?? ''] ?? (hasScoped ? {} : fields)) as Record<string, unknown>;
      const selected = typeof modelFields.selected_model === 'string' ? modelFields.selected_model : '';
      const base: AiProviderHealthItem = {
        id: String(provider.id), key, name, catalog_id: provider.catalog_id, catalog: provider.catalog,
        isActive: provider.is_active, is_default: provider.is_default,
        use_api_key: provider.use_api_key, use_token_plan_web: web, use_token_plan_agentic: agentic,
        default_mode: defaultMode, auto_rotate_api_keys: provider.auto_rotate_api_keys,
        mode: (defaultMode as AiConnectionMode) ?? null,
        status: 'unconfigured', statusBadge: 'SIN VERIFICAR', serviceState: 'Sin integración de sesión verificada',
        lastCheck: null, latencyMs: null, hasConnection: false, fields,
        selectedModel: selected, availableModels: Array.isArray(modelFields.available_models) ? modelFields.available_models : [],
        assignedModels: { ...(typeof modelFields.ocr_model === 'string' ? { ocr: modelFields.ocr_model } : {}), ...(selected ? { infer: selected } : {}) },
        apiKeysCount: provider.api_keys?.length ?? 0,
      };
      if (!provider.is_active) {
        health.push({ ...base, serviceState: 'Proveedor desactivado', statusBadge: 'DESACTIVADO' });
        continue;
      }
      if (!['gemini', 'google'].includes(key) || (!web && !agentic)) {
        health.push({ ...base, ...(!web && !agentic ? { statusBadge: 'SIN CONFIGURAR' } : {}) });
        alerts.push({ id: 'alert-' + provider.id + '-no-modes', provider: key, type: 'warning', severity: 'warning',
          title: 'INTEGRACIÓN NO VERIFICADA: ' + name.toUpperCase(),
          message: 'No hay un canal de sesión Gemini Web o Antigravity habilitado y verificable para este proveedor.',
          actionType: 'configure', actionLabel: 'Configurar Proveedor' });
        continue;
      }
      const checks = await Promise.all([
        web ? this.checkEngineHealth('web') : null,
        agentic ? this.checkEngineHealth('agentic') : null,
      ]);
      const observed = checks.filter((check) => check !== null);
      const healthy = observed.filter((check) => check.healthy === true).length;
      const unknown = observed.some((check) => check.healthy === null);
      for (const [index, check] of checks.entries()) {
        if (!check || check.healthy === true) continue;
        const engine = index === 0 ? 'web' : 'agentic';
        alerts.push({ id: 'alert-' + provider.id + '-' + engine + (engine === 'web' ? '-expired' : '-unavailable'), provider: key, type: 'incident', severity: 'error',
          title: 'INCIDENTE ACTIVO: ' + name.toUpperCase() + (engine === 'web' ? ' (SESIÓN WEB)' : ' (MODO AGÉNTICO)'),
          message: check.healthy === null ? 'No se pudo comprobar el estado del servicio.'
            : engine === 'web' ? 'La sesión Web no está autenticada o disponible.' : 'El adaptador Antigravity no está disponible o no tiene una sesión activa.',
          timestamp: new Date().toISOString(), actionType: engine === 'web' ? 'renew_session' : 'configure',
          actionLabel: engine === 'web' ? 'Renovar Sesión Ahora' : 'Verificar Entorno' });
      }
      const status = healthy === observed.length ? 'healthy' : healthy > 0 ? 'degraded' : unknown ? 'unconfigured' : 'expired';
      const latencies = observed.flatMap((check) => check.latency === null ? [] : [check.latency]);
      health.push({ ...base, hasConnection: true, status,
        statusBadge: status === 'healthy' ? 'DISPONIBLE' : status === 'degraded' ? 'DEGRADADO' : unknown ? 'SIN VERIFICAR' : web && !agentic ? 'REQUIERE INICIAR SESIÓN' : 'INCIDENTE ACTIVO',
        serviceState: status === 'healthy' ? web && agentic ? 'Sesiones Web y Agentic disponibles' : web ? 'Sesión Web Disponible' : 'Modo Agéntico Disponible'
          : status === 'degraded' ? checks[0]?.healthy === false ? 'Sesión Web inactiva (Agentic operativo)' : 'Agentic inactivo (Sesión Web operativa)' : unknown ? 'Estado no comprobado' : 'Sin canales operativos',
        lastCheck: latencies.length ? new Date().toISOString() : null,
        latencyMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
        engine: defaultMode === 'token_plan_agentic' ? 'agentic' : 'web',
      });
    }
    return { timestamp: new Date().toISOString(),
      overallStatus: alerts.some((alert) => alert.severity === 'error') ? 'incident' : alerts.length ? 'degraded' : 'healthy',
      alerts, providers: health, summary: { totalProviders: providers.length,
        activeProviders: providers.filter((provider) => provider.is_active).length,
        healthyProviders: health.filter((provider) => provider.status === 'healthy').length, incidentsCount: alerts.length } };
  }
}
