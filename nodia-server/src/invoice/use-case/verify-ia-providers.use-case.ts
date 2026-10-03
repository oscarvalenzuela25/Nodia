import { Injectable, Optional } from '@nestjs/common';
import { GeminiService } from '../../common/ai/gemini.service.js';
import {
  VerifyIaProviderItem,
  VerifyIaProvidersResponse,
} from '../types/invoice.types.js';
import { AiProviderService } from '../../ai-provider/ai-provider.service.js';
import {
  AiConnectionMode,
  AiKeyHealthState,
} from '../../ai-provider/types/ai-provider.types.js';

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

        const useApiKey = Boolean(prov.use_api_key ?? (prov.mode !== AiConnectionMode.WEB_SESSION));
        const useTokenPlanWeb = Boolean(
          prov.use_token_plan_web ??
            (prov.mode === AiConnectionMode.WEB_SESSION || prov.catalog?.can_use_token_plan_web),
        );
        const useTokenPlanAgentic = Boolean(
          prov.use_token_plan_agentic ?? prov.catalog?.can_use_token_plan_agentic,
        );
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
            ? [configuredDefaultMode, ...registeredModes.filter((m) => m !== configuredDefaultMode)]
            : registeredModes;

        let selectedActiveMode: ConnectionChannel | null = null;
        let selectedModeData: ResolvedModeData | null = null;
        let firstModeWithModels: { mode: ConnectionChannel; data: ResolvedModeData; error: string } | null = null;
        let hasAnyModeWithModels = false;

        for (const candidateMode of candidateModes) {
          const modeData = this.resolveModeData(prov, candidateMode, provKey);
          if (!modeData) {
            // Este modo no tiene modelos configurados, continúa con el siguiente modo
            continue;
          }

          hasAnyModeWithModels = true;

          // Verificar credenciales / conectividad para este modo
          const credCheck = await this.verifyModeCredentials(prov, candidateMode, provKey);
          if (credCheck.valid) {
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
    } catch {
      return result;
    }
  }

  private resolveModeData(
    prov: any,
    mode: ConnectionChannel,
    provKey: string,
  ): ResolvedModeData | null {
    const fields = prov.fields || {};
    const modeFields = fields[mode];

    // Buscar modelo default del modo
    const rawSelectedModel =
      modeFields?.selected_model ||
      modeFields?.default_model ||
      (mode === prov.default_mode || (!fields.token_plan_web && !fields.token_plan_agentic && !fields.api_key)
        ? fields.selected_model || fields.model
        : null) ||
      fields.selected_model ||
      null;

    const availableModels: any[] =
      Array.isArray(modeFields?.available_models) && modeFields.available_models.length > 0
        ? modeFields.available_models
        : Array.isArray(fields.available_models)
          ? fields.available_models
          : [];

    const defaultModel =
      rawSelectedModel ||
      (availableModels.length > 0
        ? (availableModels.find((m: any) => m.isRecommended)?.id || availableModels[0]?.id)
        : null);

    if (!defaultModel || typeof defaultModel !== 'string' || defaultModel.trim() === '') {
      return null;
    }

    // Modelo OCR: específico para OCR si existe, de lo contrario fallback al modelo por defecto
    const rawOcrModel =
      modeFields?.ocr_focus_model ||
      modeFields?.ocr_model ||
      fields.ocr_focus_model ||
      fields.ocr_model ||
      null;

    const ocrModel =
      rawOcrModel && typeof rawOcrModel === 'string' && rawOcrModel.trim() !== ''
        ? rawOcrModel
        : defaultModel;

    // Thinking
    const activeModelDef = availableModels.find((m: any) => m.id === defaultModel);
    const supportsThinking = Boolean(
      activeModelDef?.capabilities?.includes('reasoning') ||
      activeModelDef?.id?.toLowerCase().includes('thinking') ||
      defaultModel.toLowerCase().includes('thinking') ||
      (provKey === 'gemini' && !defaultModel.toLowerCase().includes('lite')),
    );
    const extendedThinkingEnabled = Boolean(
      (modeFields?.enable_extended_thinking ?? fields.enable_extended_thinking) &&
      supportsThinking,
    );

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
    prov: any,
    mode: ConnectionChannel,
    provKey: string,
  ): Promise<{ valid: boolean; error?: string }> {
    if (mode === 'token_plan_agentic') {
      if (provKey === 'gemini') {
        const isAgenticActive = await this.geminiService.verifyProvider('agentic');
        if (!isAgenticActive) {
          return {
            valid: false,
            error: 'La sesión de Gemini Agentic no está activa o requiere inicio de sesión.',
          };
        }
        return { valid: true };
      }
      return { valid: false, error: 'Proveedor no soportado en modo agentic.' };
    }

    if (mode === 'token_plan_web') {
      if (provKey === 'gemini') {
        const isWebActive = await this.geminiService.verifyProvider('web');
        if (!isWebActive) {
          return {
            valid: false,
            error: 'La sesión de Gemini requiere renovación o inicio de sesión.',
          };
        }
        return { valid: true };
      }
      return { valid: false, error: 'Proveedor no soportado en modo web.' };
    }

    if (mode === 'api_key') {
      const apiKeys = prov.api_keys || [];
      const validKeys = apiKeys.filter(
        (k: any) =>
          k.is_active && k.health_state !== AiKeyHealthState.COOLDOWN,
      );
      if (validKeys.length === 0) {
        return {
          valid: false,
          error: 'No cuenta con API Keys activas o disponibles.',
        };
      }
      return { valid: true };
    }

    return { valid: false, error: 'Modo de conexión no compatible.' };
  }
}
