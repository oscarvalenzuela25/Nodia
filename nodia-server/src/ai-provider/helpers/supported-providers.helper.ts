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
  const key = provider.key?.toLowerCase();
  const supported = getSupportedProviderByKey(key);
  if (supported) {
    const fields = { ...(provider.fields || {}) };
    const validModelIds = new Set(supported.availableModels.map((m) => m.id));

    if (key === 'gemini') {
      fields.available_models = supported.availableModels;
      if (
        !fields.selected_model ||
        !validModelIds.has(fields.selected_model) ||
        String(fields.selected_model).includes('2.5') ||
        String(fields.selected_model).includes('2.0') ||
        String(fields.selected_model).includes('1.5')
      ) {
        fields.selected_model = supported.defaultSelectedModel || 'gemini-flash';
      }
    } else {
      if (fields.available_models && Array.isArray(fields.available_models)) {
        fields.available_models = fields.available_models.filter(
          (m: any) =>
            !m.id?.includes('2.5') &&
            !m.id?.includes('2.0') &&
            !m.id?.includes('1.5'),
        );
        if (fields.available_models.length === 0) {
          fields.available_models = supported.availableModels;
        }
      } else {
        fields.available_models = supported.availableModels;
      }
      if (
        fields.selected_model &&
        (String(fields.selected_model).includes('2.5') ||
          String(fields.selected_model).includes('2.0') ||
          String(fields.selected_model).includes('1.5'))
      ) {
        fields.selected_model = supported.defaultSelectedModel;
      }
    }

    provider.fields = fields;
  }
  return provider;
};
