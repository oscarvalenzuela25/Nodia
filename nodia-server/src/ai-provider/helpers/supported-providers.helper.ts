import {
  SUPPORTED_AI_PROVIDERS,
  SupportedProviderDef,
} from '../constants/supported-providers.constant.js';

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

  return SUPPORTED_AI_PROVIDERS.filter((p) => keys.includes(p.key.toLowerCase()));
};

export const getSupportedProviderByKey = (
  key: string,
): SupportedProviderDef | undefined => {
  return SUPPORTED_AI_PROVIDERS.find(
    (p) => p.key.toLowerCase() === key.trim().toLowerCase(),
  );
};

export const sanitizeProviderFields = (provider: any): any => {
  if (!provider) return provider;
  if (!provider.fields) {
    provider.fields = {};
  }

  // Ensure available_models is an array if present, but never inject default models
  if (provider.fields.available_models && !Array.isArray(provider.fields.available_models)) {
    provider.fields.available_models = [];
  }

  // Mask any direct sensitive keys in fields if any exist
  const sensitiveKeys = ['secret', 'api_key', 'apiKey', 'password', 'token', 'access_token'];
  for (const k of sensitiveKeys) {
    if (provider.fields[k] && typeof provider.fields[k] === 'string') {
      const val = provider.fields[k];
      provider.fields[k] = val.length > 8 ? `${val.slice(0, 4)}...${val.slice(-4)}` : '****';
    }
  }
  return provider;
};
