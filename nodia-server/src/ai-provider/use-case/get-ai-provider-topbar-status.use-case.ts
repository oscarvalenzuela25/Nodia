import { Injectable } from '@nestjs/common';
import { CodexRuntimeService } from '../../common/ai/codex/codex-runtime.service.js';
import { GeminiAgenticLogoutService } from '../../common/ai/gemini-agentic-logout.service.js';
import { GeminiService } from '../../common/ai/gemini.service.js';
import { AiProviderService } from '../ai-provider.service.js';

type AgenticStatus = {
  available: boolean | null;
  authenticated: boolean | null;
  usageAllowed?: boolean | null;
  reason?: 'codex_runtime_unverified' | 'codex_profile_busy' | 'runtime_busy';
};

type AiProviderTopbarStatus = {
  provider: {
    name: string;
    key: string;
    isActive: boolean;
    use_api_key: boolean;
    use_agentic: boolean;
    hasApiKey: boolean;
    agentic: AgenticStatus | null;
  } | null;
};

const booleanOrNull = (value: unknown) =>
  typeof value === 'boolean' ? value : null;

@Injectable()
export class GetAiProviderTopbarStatusUseCase {
  private readonly pendingObservations = new Map<
    string,
    Promise<AgenticStatus | null>
  >();

  constructor(
    private readonly providers: AiProviderService,
    private readonly gemini: GeminiService,
    private readonly codex: CodexRuntimeService,
    private readonly geminiLogout: GeminiAgenticLogoutService,
  ) {}

  async execute(): Promise<AiProviderTopbarStatus> {
    const provider = await this.providers.findDefaultProviderStatus();
    if (!provider) return { provider: null };
    const key = provider.key?.toLowerCase() ?? '';
    return {
      provider: {
        name: provider.name || provider.catalogName || key,
        key,
        isActive: provider.isActive,
        use_api_key: provider.use_api_key,
        use_agentic: provider.use_agentic,
        hasApiKey: provider.hasApiKey,
        agentic:
          provider.isActive && provider.use_agentic
            ? await this.observe(provider.id, key)
            : null,
      },
    };
  }

  private async observe(
    id: string,
    key: string,
  ): Promise<AgenticStatus | null> {
    const isGemini = key === 'gemini' || key === 'google';
    const revision = isGemini ? this.geminiLogout.observationRevision : 0;
    const identity = `${key}:${id}:${revision}`;
    const pending = this.pendingObservations.get(identity);
    if (pending) return pending;

    // Concurrent Topbars share a bounded read of the same native profile.
    const observation = this.observeAgentic(id, key)
      .then((status) =>
        isGemini && revision !== this.geminiLogout.observationRevision
          ? null
          : status,
      )
      .catch(() => null);
    this.pendingObservations.set(identity, observation);
    try {
      return await observation;
    } finally {
      this.pendingObservations.delete(identity);
    }
  }

  private async observeAgentic(
    id: string,
    key: string,
  ): Promise<AgenticStatus | null> {
    if (key === 'openai') {
      const session = await this.codex.observe(id, AbortSignal.timeout(30_000));
      if (!session) return null;
      const { reason } = session;
      const usageAllowed = booleanOrNull(session.usageAllowed);
      if (
        reason === 'codex_runtime_unverified' ||
        reason === 'codex_profile_busy'
      )
        return { available: null, authenticated: null, usageAllowed, reason };
      return {
        available: booleanOrNull(session.available),
        authenticated: booleanOrNull(session.authenticated),
        usageAllowed,
      };
    }

    if (key !== 'gemini' && key !== 'google') return null;
    const status = (await this.gemini.getDualEngineStatus())?.agentic;
    if (!status) return null;
    if (status.reason === 'runtime_busy')
      return { available: null, authenticated: null, reason: 'runtime_busy' };
    if (
      status.reason === 'agentic_timeout' ||
      status.reason === 'agentic_login_in_progress' ||
      status.reason === 'agentic_session_unverified' ||
      status.reason === 'session_adapter_unverified'
    )
      return null;
    return {
      available: booleanOrNull(status.available),
      authenticated: booleanOrNull(
        status.authenticated ?? status.has_active_session,
      ),
    };
  }
}
