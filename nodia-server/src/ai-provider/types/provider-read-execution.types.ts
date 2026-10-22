import type { AiProvider } from '../entities/ai-provider.entity.js';

/** Internal execution snapshot. Never accepted from HTTP or persisted as tool arguments. */
export interface ProviderReadExecution {
  readonly providers: readonly AiProvider[];
  readonly signal: AbortSignal;
  readonly selectedSecret: (providerId: string) => Promise<string | null>;
}
