import {
  SUPPORTED_AI_PROVIDERS,
  SupportedProviderDef,
} from '../constants/supported-providers.constant.js';
import type { AiProvider } from '../entities/ai-provider.entity.js';
import { configuredModelFields } from './model-observation.helper.js';

export const getSupportedAiProviders = (): SupportedProviderDef[] => {
  const envVal = process.env.SUPPORTED_AI_PROVIDERS;
  if (!envVal || envVal.trim() === '') {
    return SUPPORTED_AI_PROVIDERS;
  }

  const raw = envVal.trim();
  let keys: string[] = [];

  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        keys = parsed.map((item) => String(item).trim().toLowerCase());
      }
    } catch {
      keys = [];
    }
  } else {
    keys = raw
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length > 0);
  }

  if (keys.length === 0) {
    return SUPPORTED_AI_PROVIDERS;
  }

  return SUPPORTED_AI_PROVIDERS.filter((p) =>
    keys.includes(p.key.toLowerCase()),
  );
};

export const getSupportedProviderByKey = (
  key: string,
): SupportedProviderDef | undefined => {
  return SUPPORTED_AI_PROVIDERS.find(
    (p) => p.key.toLowerCase() === key.trim().toLowerCase(),
  );
};

export const sanitizeProviderFields = <T extends Partial<AiProvider>>(
  provider: T,
) => {
  if (!provider) return provider;
  // Translation attachment copies enumerable fields; entity getters are lost.
  // Materialize the public identity and mode instead of relying on the prototype.
  const result = {
    ...provider,
    key: provider.catalog?.key ?? provider.key,
    mode:
      provider.default_mode ??
      provider.mode ??
      (provider.use_token_plan_agentic
        ? 'token_plan_agentic'
        : provider.use_token_plan_web
          ? 'web_session'
          : provider.use_api_key
            ? 'api_key'
            : null),
    fields: configuredModelFields(provider.fields ?? {}),
  };

  // Ensure available_models is an array if present, but never inject default models
  if (
    result.fields.available_models &&
    !Array.isArray(result.fields.available_models)
  ) {
    result.fields.available_models = [];
  }

  // Mask any direct sensitive keys in fields if any exist
  const sensitiveKeys = [
    'secret',
    'api_key',
    'apiKey',
    'password',
    'token',
    'access_token',
  ];
  for (const k of sensitiveKeys) {
    if (result.fields[k] && typeof result.fields[k] === 'string') {
      const val = result.fields[k];
      result.fields[k] =
        val.length > 8 ? `${val.slice(0, 4)}...${val.slice(-4)}` : '****';
    }
  }
  return result;
};
