export function getEnabledWebAiProviders(): string[] {
  const envVal = process.env.ENABLED_WEB_AI_PROVIDERS;
  if (!envVal || !envVal.trim()) return [];

  try {
    if (envVal.trim().startsWith('[')) {
      const parsed = JSON.parse(envVal);
      if (Array.isArray(parsed)) {
        return parsed
          .map((p) => String(p).trim().toLowerCase())
          .filter(Boolean);
      }
    }
  } catch {
    // fallback to comma-separated
  }

  return envVal
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
}
