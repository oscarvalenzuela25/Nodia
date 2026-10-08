import { BadGatewayException, HttpException, Injectable, Optional } from '@nestjs/common';
import { GeminiService } from '../../common/ai/gemini.service.js';
import {
  VerifyIaProvidersResponse,
} from '../types/invoice.types.js';
import { AiProviderService } from '../../ai-provider/ai-provider.service.js';
import {
  AiConnectionMode,
} from '../../ai-provider/types/ai-provider.types.js';
import { ApiProviderService } from '../../common/ai/api-provider.service.js';
import { observedModels } from '../../ai-provider/helpers/model-observation.helper.js';

type ConnectionChannel = 'api_key' | 'token_plan_web' | 'token_plan_agentic';

interface ResolvedModeData {
  mode: ConnectionChannel;
  defaultModel: string;
  ocrModel: string;
  supportsThinking: boolean;
  extendedThinkingEnabled: boolean;
  availableModels: any[];
}

@Injectable()
export class VerifyIaProvidersUseCase {
  constructor(
    private readonly geminiService: GeminiService,
    @Optional()
    private readonly aiProviderService?: AiProviderService,
    @Optional() private readonly apiService?: ApiProviderService,
  ) {}

  async execute(): Promise<VerifyIaProvidersResponse> {
    const result: VerifyIaProvidersResponse = [];

    if (!this.aiProviderService) {
      return result;
    }

    try {
      const providersResponse = await this.aiProviderService.findAllProviders({
        all: true,
        includes: true,
      });

      const providers = providersResponse.data || [];

      for (const prov of providers) {
        const provKey = (prov.key || prov.catalog?.key || '').toLowerCase();
        const provName =
          prov.name ||
          prov.catalog?.name ||
          (provKey === 'gemini'
            ? 'Google Gemini'
            : provKey === 'mistral'
              ? 'Mistral AI'
              : prov.key || 'Proveedor AI');

        const catalogCanApiKey = prov.catalog ? prov.catalog.can_use_api_key !== false : true;
        const catalogCanWeb = prov.catalog ? Boolean(prov.catalog.can_use_token_plan_web) : provKey === 'gemini';
        const catalogCanAgentic = prov.catalog ? Boolean(prov.catalog.can_use_token_plan_agentic) : provKey === 'gemini';

        const useApiKey = Boolean(prov.use_api_key ?? (prov.mode !== AiConnectionMode.WEB_SESSION));
        const useTokenPlanWeb = Boolean(
          prov.use_token_plan_web ??
            (prov.mode === AiConnectionMode.WEB_SESSION),
        );
        const useTokenPlanAgentic = Boolean(prov.use_token_plan_agentic);
        const configuredDefaultMode = (prov.default_mode as ConnectionChannel) || null;
        const isDefault = Boolean(prov.is_default);

        // 1. Verificar si el proveedor está activo
        if (!prov.is_active) {
          result.push({
            id: String(prov.id),
            key: provKey,
            name: provName,
            mode: configuredDefaultMode || prov.mode || 'api_key',
            use_api_key: useApiKey,
            use_token_plan_web: useTokenPlanWeb,
            use_token_plan_agentic: useTokenPlanAgentic,
            default_mode: configuredDefaultMode,
            active_mode: null,
            is_default: isDefault,
            is_active: false,
            can_use_model: false,
            error: 'El proveedor está inactivo.',
            fields: prov.fields || {},
            default_model: null,
            ocr_model: null,
            supports_thinking: false,
            extended_thinking_enabled: false,
          });
          continue;
        }

        // 2. Obtener modos registrados en true
        const registeredModes: ConnectionChannel[] = [];
        if (useTokenPlanAgentic) registeredModes.push('token_plan_agentic');
        if (useTokenPlanWeb) registeredModes.push('token_plan_web');
        if (useApiKey) registeredModes.push('api_key');

        if (registeredModes.length === 0) {
          result.push({
            id: String(prov.id),
            key: provKey,
            name: provName,
            mode: configuredDefaultMode || prov.mode || 'api_key',
            use_api_key: false,
            use_token_plan_web: false,
            use_token_plan_agentic: false,
            default_mode: configuredDefaultMode,
            active_mode: null,
            is_default: isDefault,
            is_active: true,
            can_use_model: false,
            error: 'El proveedor no tiene ningún modo de conexión habilitado.',
            fields: prov.fields || {},
            default_model: null,
            ocr_model: null,
            supports_thinking: false,
            extended_thinking_enabled: false,
          });
          continue;
        }

        // 3. Orden de evaluación: primero el default (si está habilitado), luego los demás
        const candidateModes: ConnectionChannel[] =
          configuredDefaultMode && registeredModes.includes(configuredDefaultMode)
            ? (this.resolveModeData(prov, configuredDefaultMode) ? [configuredDefaultMode, ...registeredModes.filter((m) => m !== configuredDefaultMode)] : [configuredDefaultMode])
            : registeredModes;

        let selectedActiveMode: ConnectionChannel | null = null;
        let selectedModeData: ResolvedModeData | null = null;
        let firstModeWithModels: { mode: ConnectionChannel; data: ResolvedModeData; error: string } | null = null;

        for (const candidateMode of candidateModes) {
          const modeData = this.resolveModeData(prov, candidateMode);
          if (!modeData) {
            // Este modo no tiene modelos configurados, continúa con el siguiente modo
            continue;
          }


          // Verificar credenciales / conectividad para este modo
          const catalogRejectsApi = candidateMode === 'api_key' && ['gemini', 'openai'].includes(provKey)
            && (prov.catalog && (prov.catalog?.can_use_api_key === false || prov.catalog?.is_active === false));
          const credCheck = catalogRejectsApi
            ? { valid: false, error: 'El catálogo no permite ejecutar el canal API de esta conexión.', models: undefined }
            : await this.verifyModeCredentials(candidateMode, provKey, String(prov.id));
          if (credCheck.valid) {
            const match = (selection: string) => {
              const matches = credCheck.models?.filter((model) => model.id === selection || model.name === selection) ?? [];
              return matches.length === 1 ? matches[0] : null;
            };
            const liveModel = match(modeData.defaultModel);
            const liveOcr = match(modeData.ocrModel);
            if (!liveModel || !liveOcr) {
              firstModeWithModels ??= { mode: candidateMode, data: modeData, error: 'El modelo configurado no está en el catálogo descubierto de esta sesión.' };
              continue;
            }
            modeData.supportsThinking = candidateMode === 'token_plan_web'
              ? credCheck.extendedThinking === true : liveModel.capabilities.includes('reasoning');
            modeData.defaultModel = liveModel.id;
            modeData.ocrModel = liveOcr.id;
            const fields = prov.fields?.[candidateMode] ?? prov.fields ?? {};
            modeData.extendedThinkingEnabled = modeData.supportsThinking && fields.enable_extended_thinking === true;
            selectedActiveMode = candidateMode;
            selectedModeData = modeData;
            break;
          } else {
            if (!firstModeWithModels) {
              firstModeWithModels = {
                mode: candidateMode,
                data: modeData,
                error: credCheck.error || 'Credenciales no válidas para este modo.',
              };
            }
          }
        }

        if (selectedActiveMode && selectedModeData) {
          result.push({
            id: String(prov.id),
            key: provKey,
            name: provName,
            mode: selectedActiveMode,
            use_api_key: useApiKey,
            use_token_plan_web: useTokenPlanWeb,
            use_token_plan_agentic: useTokenPlanAgentic,
            default_mode: configuredDefaultMode,
            active_mode: selectedActiveMode,
            is_default: isDefault,
            is_active: true,
            can_use_model: true,
            error: null,
            fields: prov.fields || {},
            default_model: selectedModeData.defaultModel,
            ocr_model: selectedModeData.ocrModel,
            supports_thinking: selectedModeData.supportsThinking,
            extended_thinking_enabled: selectedModeData.extendedThinkingEnabled,
          });
        } else if (firstModeWithModels) {
          result.push({
            id: String(prov.id),
            key: provKey,
            name: provName,
            mode: firstModeWithModels.mode,
            use_api_key: useApiKey,
            use_token_plan_web: useTokenPlanWeb,
            use_token_plan_agentic: useTokenPlanAgentic,
            default_mode: configuredDefaultMode,
            active_mode: null,
            is_default: isDefault,
            is_active: true,
            can_use_model: false,
            error: firstModeWithModels.error,
            fields: prov.fields || {},
            default_model: firstModeWithModels.data.defaultModel,
            ocr_model: firstModeWithModels.data.ocrModel,
            supports_thinking: firstModeWithModels.data.supportsThinking,
            extended_thinking_enabled: firstModeWithModels.data.extendedThinkingEnabled,
          });
        } else {
          result.push({
            id: String(prov.id),
            key: provKey,
            name: provName,
            mode: candidateModes[0] || 'api_key',
            use_api_key: useApiKey,
            use_token_plan_web: useTokenPlanWeb,
            use_token_plan_agentic: useTokenPlanAgentic,
            default_mode: configuredDefaultMode,
            active_mode: null,
            is_default: isDefault,
            is_active: true,
            can_use_model: false,
            error: 'No tiene un modelo por defecto asignado.',
            fields: prov.fields || {},
            default_model: null,
            ocr_model: null,
            supports_thinking: false,
            extended_thinking_enabled: false,
          });
        }
      }

      result.sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0));
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadGatewayException('No se pudo comprobar el estado de los proveedores IA.');
    }
  }

  private resolveModeData(
    prov: any,
    mode: ConnectionChannel,
  ): ResolvedModeData | null {
    const fields = prov.fields || {};
    const hasScoped = Boolean(fields.token_plan_web || fields.token_plan_agentic || fields.api_key);
    const modeFields = fields[mode] ?? (hasScoped ? {} : fields);

    // Buscar modelo default del modo
    const rawSelectedModel =
      modeFields?.selected_model ||
      modeFields?.default_model ||
      modeFields?.model ||
      null;

    const availableModels: any[] =
      Array.isArray(modeFields?.available_models)
        ? modeFields.available_models
        : [];

    const defaultModel = rawSelectedModel;

    if (!defaultModel || typeof defaultModel !== 'string' || defaultModel.trim() === '') {
      return null;
    }

    // Modelo OCR: específico para OCR si existe, de lo contrario fallback al modelo por defecto
    const rawOcrModel =
      modeFields?.ocr_focus_model ||
      modeFields?.ocr_model ||
      null;

    const ocrModel =
      rawOcrModel && typeof rawOcrModel === 'string' && rawOcrModel.trim() !== ''
        ? rawOcrModel
        : defaultModel;

    // Thinking
    const supportsThinking = false;
    const extendedThinkingEnabled = false;

    return {
      mode,
      defaultModel,
      ocrModel,
      supportsThinking,
      extendedThinkingEnabled,
      availableModels,
    };
  }

  private async verifyModeCredentials(
    mode: ConnectionChannel,
    provKey: string,
    providerId: string,
  ): Promise<{ valid: boolean; error?: string; models?: ReturnType<typeof observedModels>; extendedThinking?: boolean }> {
    if (mode === 'token_plan_agentic') {
      if (provKey === 'gemini') {
        const discovery = await this.geminiService.getModelsAndQuota('agentic');
        const isAgenticActive = discovery?.available === true && discovery?.authenticated === true;
        if (!isAgenticActive) {
          return {
            valid: false,
            error: 'La sesión de Gemini Agentic no está activa o requiere inicio de sesión.',
          };
        }
        return { valid: true, models: observedModels(discovery.models ?? []), extendedThinking: discovery.supported_options?.extended_thinking === true };
      }
      return { valid: false, error: 'Proveedor no soportado en modo agentic.' };
    }

    if (mode === 'token_plan_web') {
      if (provKey === 'gemini') {
        const discovery = await this.geminiService.getModelsAndQuota('web');
        const isWebActive = discovery?.authenticated === true;
        if (!isWebActive) {
          return {
            valid: false,
            error: 'La sesión de Gemini requiere renovación o inicio de sesión.',
          };
        }
        return { valid: true, models: observedModels(discovery.models ?? []), extendedThinking: discovery.supported_options?.extended_thinking === true };
      }
      return { valid: false, error: 'Proveedor no soportado en modo web.' };
    }

    if (mode === 'api_key') {
      if (!['gemini', 'openai'].includes(provKey)) return { valid: false, error: 'El modo API Key no tiene una integración de sesión admitida.' };
      if (!this.apiService || !this.aiProviderService) return { valid: false, error: 'Adaptador API no disponible.' };
      const secret = await this.aiProviderService.getActiveApiKeySecret(providerId);
      if (!secret) return { valid: false, error: 'Debe agregar y seleccionar una API key activa.' };
      try { return { valid: true, models: await this.apiService.listModels(provKey, secret) }; }
      catch (error) { return { valid: false, error: error instanceof HttpException ? error.message : 'No se pudo verificar el catálogo API.' }; }
    }

    return { valid: false, error: 'Modo de conexión no compatible.' };
  }
}
