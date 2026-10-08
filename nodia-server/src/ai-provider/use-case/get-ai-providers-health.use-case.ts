import { Injectable, Optional } from '@nestjs/common';
import { AiProviderService } from '../ai-provider.service.js';
import { GeminiService } from '../../common/ai/gemini.service.js';
import { AiConnectionMode } from '../types/ai-provider.types.js';
import type { GeminiExecutionEngine } from '../../common/ai/ai.types.js';
import { isAgenticSessionActive, type GeminiDualEngineStatus } from '../../common/ai/gemini-engine-status.js';
import { configuredModelFields } from '../helpers/model-observation.helper.js';
import { CodexRuntimeService } from '../../common/ai/codex/codex-runtime.service.js';
import type { CodexSession } from '../../common/ai/codex/codex-contract.js';

export interface AiProviderAlert {
  id: string;
  provider: string;
  providerName?: string;
  reason?: 'agentic_session_required' | 'agentic_adapter_unavailable' | 'service_status_unknown';
  type: 'incident' | 'failover' | 'warning' | 'info';
  severity: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp?: string;
  timeAgo?: string;
  providerId?: string;
  actionType: 'renew_session' | 'manage_quotas' | 'configure' | 'authenticate_agentic' | 'check_status';
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
  status: 'healthy' | 'degraded' | 'expired' | 'unconfigured' | 'unverified';
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
  selectedApiKey?: {
    id: string;
    label: string;
    display_hint: string;
    is_active: boolean;
  } | null;
  hasConnection: boolean;
  engine?: 'agentic' | 'web';
  codexSession?: CodexSession;
}

export interface AiProvidersHealthResponse {
  timestamp: string;
  engines: GeminiDualEngineStatus | null;
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
  constructor(private readonly aiProviderService: AiProviderService, private readonly geminiService: GeminiService,
    @Optional() private readonly codex?: CodexRuntimeService) {}

  private async checkEngineHealth(engine: GeminiExecutionEngine, sharedStatus?: ReturnType<GeminiService['getDualEngineStatus']>) {
    const started = performance.now();
    try {
      if (typeof this.geminiService.getDualEngineStatus === 'function') {
        const status = await (sharedStatus ?? this.geminiService.getDualEngineStatus());
        if (!status) return { healthy: null, latency: null, available: null };
        if (engine === 'agentic' && (typeof status.agentic?.available !== 'boolean'
          || (status.agentic.available && typeof (status.agentic.authenticated ?? status.agentic.has_active_session) !== 'boolean'))) {
          return { healthy: null, latency: null, available: null };
        }
        return { healthy: engine === 'agentic' ? isAgenticSessionActive(status.agentic)
          : status.web?.authenticated === true && status.web?.available !== false,
          latency: Math.round(performance.now() - started),
          available: engine === 'agentic' && typeof status.agentic?.available === 'boolean' ? status.agentic.available : null };
      }
      const status = await this.geminiService.getModelsAndQuota(engine);
      if (typeof status?.authenticated !== 'boolean') return { healthy: null, latency: null, available: null };
      if (engine === 'agentic' && typeof status.available !== 'boolean') return { healthy: null, latency: null, available: null };
      return { healthy: engine === 'agentic' ? isAgenticSessionActive(status) : status.authenticated === true,
        latency: Math.round(performance.now() - started),
        available: engine === 'agentic' && typeof status.available === 'boolean' ? status.available : null };
    } catch { return { healthy: null, latency: null, available: null }; }
  }

  async execute(): Promise<AiProvidersHealthResponse> {
    const response = await this.aiProviderService.findAllProviders({ all: true, includes: true });
    const providers = response.data ?? [];
    const alerts: AiProviderAlert[] = [];
    const health: AiProviderHealthItem[] = [];
    let sharedStatus: ReturnType<GeminiService['getDualEngineStatus']> | undefined;
    const engineChecks = new Map<GeminiExecutionEngine, ReturnType<GetAiProvidersHealthUseCase['checkEngineHealth']>>();
    const checkEngine = (engine: GeminiExecutionEngine) => {
      if (!engineChecks.has(engine)) {
        engineChecks.set(engine, this.checkEngineHealth(engine, sharedStatus));
      }
      return engineChecks.get(engine)!;
    };
    for (const provider of providers) {
      const key = (provider.catalog?.key ?? provider.key ?? '').toLowerCase();
      const name = provider.name || provider.catalog?.name || key;
      const web = provider.use_token_plan_web ?? (provider.mode === 'web_session' || provider.mode === 'token_plan_web');
      const api = provider.use_api_key === true;
      const agentic = provider.use_token_plan_agentic ?? provider.mode === 'token_plan_agentic';
      const defaultMode = provider.default_mode ?? (agentic ? 'token_plan_agentic' : web ? 'token_plan_web' : api ? 'api_key' : provider.mode);
      const fields = configuredModelFields(provider.fields ?? {});
      const hasScoped = Boolean(fields.token_plan_web || fields.token_plan_agentic || fields.api_key);
      const modelFields = (fields[defaultMode ?? ''] ?? (hasScoped ? {} : fields)) as Record<string, unknown>;
      const selected = typeof modelFields.selected_model === 'string' ? modelFields.selected_model : '';
      const keys = provider.api_keys ?? [];
      const activeKeys = keys.filter((k: any) => k.is_active);
      const selectedKey = keys.find((k: any) => k.is_selected && k.is_active) ?? keys.find((k: any) => k.is_selected) ?? null;
      const selectedApiKey = selectedKey ? {
        id: String(selectedKey.id),
        label: selectedKey.label,
        display_hint: selectedKey.display_hint,
        is_active: Boolean(selectedKey.is_active),
      } : null;
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
        apiKeysCount: keys.length,
        validKeysCount: activeKeys.length,
        selectedApiKey,
      };
      if (key === 'openai' && provider.is_active && this.codex) {
        // Also expose a safe session panel while the catalogue remains API-only.
        base.codexSession = await this.codex.snapshot(String(provider.id));
        if (agentic && defaultMode === 'token_plan_agentic') {
          const session = base.codexSession;
          health.push({ ...base, hasConnection: true, engine: 'agentic',
            status: session.authenticated === true ? selected ? 'unverified' : 'degraded' : session.available ? 'expired' : 'unconfigured',
            statusBadge: session.authenticated ? 'SIN VERIFICAR' : 'REQUIERE INICIAR SESIÓN',
            serviceState: session.authenticated ? session.lastInferenceAt ? 'Codex conectado; extracción observada en este proceso' : 'Codex conectado; inferencia sin verificar' : session.available ? 'Codex requiere inicio de sesión' : 'Runtime Codex no disponible',
            lastCheck: session.checkedAt });
          if (!session.authenticated) alerts.push({ id: `alert-${provider.id}-codex`, provider: key, providerId: String(provider.id), providerName: name,
            reason: session.reason === 'codex_runtime_unverified' ? 'service_status_unknown' : session.available ? 'agentic_session_required' : 'agentic_adapter_unavailable', type: 'warning', severity: 'warning',
            title: 'Codex requiere atención', message: session.available ? 'Conecte la cuenta Codex de esta instancia.' : 'Compruebe el runtime Codex local.',
            actionType: session.available ? 'authenticate_agentic' : 'check_status', actionLabel: session.available ? 'Conectar Codex' : 'Volver a comprobar' });
          continue;
        }
      }
      if (!provider.is_active) {
        health.push({
          ...base,
          hasConnection: Boolean(api || web || agentic),
          serviceState: 'Proveedor desactivado',
          statusBadge: 'DESACTIVADO',
        });
        continue;
      }
      // Session panels also need this observation when API is the default mode.
      if (!sharedStatus && ['gemini', 'google'].includes(key) && (web || agentic)
        && typeof this.geminiService.getDualEngineStatus === 'function') {
        sharedStatus = this.geminiService.getDualEngineStatus().catch(() => null);
      }
      if (api && ['gemini', 'openai'].includes(key) && (defaultMode === 'api_key' || (!web && !agentic))) {
        const apiScoped = (fields.api_key ?? (hasScoped ? {} : fields)) as Record<string, unknown>;
        const apiModel = typeof apiScoped.selected_model === 'string' ? apiScoped.selected_model : selected;
        const hasKey = Boolean(selectedApiKey);
        const hasModel = Boolean(apiModel);
        const status = hasKey && hasModel ? 'unverified' : 'degraded';
        const serviceState = !hasKey && !hasModel
          ? 'Falta configurar clave API y modelo'
          : !hasKey
          ? 'Falta configurar clave API'
          : !hasModel
          ? 'Falta seleccionar modelo'
          : 'API configurada; inferencia sin verificar';
        health.push({
          ...base,
          hasConnection: true,
          status,
          statusBadge: 'SIN VERIFICAR',
          serviceState,
          selectedModel: apiModel || selected,
        });
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
        web ? checkEngine('web') : null,
        agentic ? checkEngine('agentic') : null,
      ]);
      const observed = checks.filter((check) => check !== null);
      const healthy = observed.filter((check) => check.healthy === true).length;
      const unknown = observed.some((check) => check.healthy === null);
      for (const [index, check] of checks.entries()) {
        if (!check || check.healthy === true) continue;
        const engine = index === 0 ? 'web' : 'agentic';
        const missingAgenticSession = engine === 'agentic' && check.available === true && check.healthy === false;
        const needsCheck = check.healthy === null || (engine === 'agentic' && !missingAgenticSession);
        const warning = check.healthy === null || missingAgenticSession;
        alerts.push({ id: 'alert-' + provider.id + '-' + engine + (engine === 'web' ? '-expired' : '-unavailable'), provider: key,
          providerName: name,
          ...(check.healthy === null ? { reason: 'service_status_unknown' as const }
            : missingAgenticSession ? { reason: 'agentic_session_required' as const }
              : engine === 'agentic' ? { reason: check.available === false ? 'agentic_adapter_unavailable' as const : 'service_status_unknown' as const } : {}),
          type: warning ? 'warning' : 'incident', severity: warning ? 'warning' : 'error',
          title: (check.healthy === null ? 'ESTADO SIN VERIFICAR: ' : missingAgenticSession ? 'SESIÓN REQUERIDA: ' : 'INCIDENTE ACTIVO: ')
            + name.toUpperCase() + (engine === 'web' ? ' (SESIÓN WEB)' : ' (MODO AGÉNTICO)'),
          message: check.healthy === null ? 'No se pudo comprobar el estado del servicio.'
            : engine === 'web' ? 'La sesión Web no está autenticada o disponible.'
              : missingAgenticSession ? 'El adaptador Agentic está disponible, pero requiere iniciar sesión con Google en el servidor.'
                : check.available === false ? 'El adaptador Antigravity no está disponible en el servidor. Revisa su configuración y vuelve a comprobar el estado.'
                  : 'No se pudo confirmar la disponibilidad del adaptador Agentic en el servidor.',
          timestamp: new Date().toISOString(), actionType: needsCheck ? 'check_status' : missingAgenticSession ? 'authenticate_agentic' : 'renew_session',
          actionLabel: needsCheck ? 'Volver a comprobar' : missingAgenticSession ? 'Autenticar sesión Agentic' : 'Renovar Sesión Ahora' });
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
    return { timestamp: new Date().toISOString(), engines: sharedStatus ? await sharedStatus : null,
      overallStatus: alerts.some((alert) => alert.severity === 'error') ? 'incident' : alerts.length ? 'degraded' : 'healthy',
      alerts, providers: health, summary: { totalProviders: providers.length,
        activeProviders: providers.filter((provider) => provider.is_active).length,
        healthyProviders: health.filter((provider) => provider.status === 'healthy').length, incidentsCount: alerts.length } };
  }
}
