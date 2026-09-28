import { Injectable, Optional } from '@nestjs/common';
import { GeminiService } from '../../common/ai/gemini.service.js';
import { VerifyIaProvidersResponse } from '../types/invoice.types.js';
import { AiProviderService } from '../../ai-provider/ai-provider.service.js';
import { getEnabledWebAiProviders } from '../../ai-provider/helpers/web-providers.helper.js';
import {
  AiConnectionMode,
  AiKeyHealthState,
} from '../../ai-provider/types/ai-provider.types.js';

@Injectable()
export class VerifyIaProvidersUseCase {
  constructor(
    private readonly geminiService: GeminiService,
    @Optional()
    private readonly aiProviderService?: AiProviderService,
  ) {}

  async execute(): Promise<VerifyIaProvidersResponse> {
    const result: VerifyIaProvidersResponse = {};

    if (!this.aiProviderService) {
      return result;
    }

    try {
      const providersResponse = await this.aiProviderService.findAllProviders({
        all: true,
        includes: true,
      });

      const providers = providersResponse.data || [];
      const enabledWebProviders = getEnabledWebAiProviders();

      for (const prov of providers) {
        const provKey = prov.key.toLowerCase();

        // 1. Debe estar activo en la tabla ai_providers
        if (!prov.is_active) {
          result[provKey] = false;
          continue;
        }

        // 2. CRÍTICO: Debe tener un modelo seleccionado. Sin modelo seleccionado no es un proveedor para utilizar.
        const selectedModel = prov.fields?.selected_model;
        if (
          !selectedModel ||
          typeof selectedModel !== 'string' ||
          selectedModel.trim() === ''
        ) {
          result[provKey] = false;
          continue;
        }

        // 3. Verificar estado de la conexión / credenciales según el modo
        const mode = prov.mode || AiConnectionMode.API_KEY;

        if (mode === AiConnectionMode.WEB_SESSION) {
          if (!enabledWebProviders.includes(provKey)) {
            result[provKey] = false;
          } else if (provKey === 'gemini') {
            const isGeminiActive = await this.geminiService.verifyProvider();
            result[provKey] = Boolean(isGeminiActive);
          } else {
            result[provKey] = false;
          }
        } else if (mode === AiConnectionMode.API_KEY) {
          const apiKeys = prov.api_keys || [];
          const validKeys = apiKeys.filter(
            (k: any) =>
              k.is_active && k.health_state !== AiKeyHealthState.COOLDOWN,
          );
          result[provKey] = validKeys.length > 0;
        } else {
          result[provKey] = false;
        }
      }

      return result;
    } catch {
      return result;
    }
  }
}
