import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { In } from 'typeorm';
import { AiProvider } from '../../../ai-provider/entities/ai-provider.entity.js';
import { AiApiKey } from '../../../ai-provider/entities/ai-api-key.entity.js';
import { AiProviderCatalog } from '../../../ai-provider/entities/ai-provider-catalog.entity.js';
import { AiProviderEvent } from '../../../ai-provider/entities/ai-provider-event.entity.js';
import { AiProviderService } from '../../../ai-provider/ai-provider.service.js';
import { TranslationService } from '../../../translation/translation.service.js';
import { Translation } from '../../../translation/entities/translation.entity.js';
import { GetAiProvidersHealthUseCase } from '../../../ai-provider/use-case/get-ai-providers-health.use-case.js';
import { GetSelectableModelsUseCase } from '../../../ai-provider/use-case/get-selectable-models.use-case.js';
import { VerifyIaProvidersUseCase } from '../../../invoice/use-case/verify-ia-providers.use-case.js';
import type { GeminiService } from '../../../common/ai/gemini.service.js';
import type { ApiProviderService } from '../../../common/ai/api-provider.service.js';
import type { CodexRuntimeService } from '../../../common/ai/codex/codex-runtime.service.js';
import type { ProviderReadExecution } from '../../../ai-provider/types/provider-read-execution.types.js';
import type {
  NodiaAiJsonObject,
  NodiaAiJsonValue,
} from '../../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  NodiaAiPreparedToolOperation,
  NodiaAiToolHandlerContext,
} from '../../../nodia-ai-tools/types/tool-registry.types.js';
import { canonicalKnowledge } from '../../../nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js';

export interface NodiaAiExternalReadPorts {
  readonly gemini: GeminiService;
  readonly api: ApiProviderService;
  readonly codex: CodexRuntimeService;
}
export type ExternalReadOperation =
  'health' | 'engines' | 'models' | 'codex' | 'eligible';
const fail = (code = 'invalid_tool_output'): never => {
  throw new Error(`nodia_ai:${code}`);
};
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail();
  return value as Record<string, unknown>;
};
const value = (
  source: Record<string, unknown>,
  name: string,
): NodiaAiJsonValue => {
  const entry = source[name];
  if (entry == null) return null;
  if (
    typeof entry === 'string' ||
    typeof entry === 'boolean' ||
    typeof entry === 'number'
  )
    return entry;
  return fail();
};
function engines(source: unknown): NodiaAiJsonValue {
  if (source == null) return null;
  const row = record(source);
  const engine = (input: unknown) => {
    const item = record(input);
    return {
      available: value(item, 'available'),
      // The private adapter's busy response does not inspect the account.
      authenticated:
        item.reason === 'runtime_busy' ? null : value(item, 'authenticated'),
      quota_observed_at: quotaObservedAt(item.quota_observed_at),
    };
  };
  return {
    active_engine: value(row, 'active_engine'),
    agentic: engine(row.agentic),
  };
}

/** The native Gemini normalizer reports Unix seconds; the MCP contract uses ISO. */
function quotaObservedAt(seconds: unknown): string | null {
  if (seconds == null) return null;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0)
    return fail();
  const date = new Date(seconds * 1000);
  if (!Number.isFinite(date.getTime())) return fail();
  return date.toISOString();
}

/** Native provider rules run against a finite SQL snapshot after its transaction commits. */
@Injectable()
export class ReadNodiaAiExternalUseCase {
  constructor(private readonly ports: NodiaAiExternalReadPorts) {}

  private service(context: NodiaAiToolHandlerContext) {
    const manager = context.manager;
    return new AiProviderService(
      manager.getRepository(AiProvider),
      manager.getRepository(AiApiKey),
      manager.getRepository(AiProviderEvent),
      manager.getRepository(AiProviderCatalog),
      new TranslationService(manager.getRepository(Translation)),
    );
  }

  private async snapshot(
    operation: ExternalReadOperation,
    input: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ) {
    const maxRows = context.maxRows;
    const maxKeys = context.maxCollectionItems;
    if (
      !Number.isInteger(maxRows) ||
      !Number.isInteger(maxKeys) ||
      !maxRows ||
      !maxKeys ||
      maxRows < 1 ||
      maxKeys < 1
    )
      fail('invalid_tool_context');
    const requested = input.provider_id;
    if (
      (operation === 'models' || operation === 'codex') &&
      requested === undefined
    )
      fail('invalid_tool_input');
    if (
      requested !== undefined &&
      (typeof requested !== 'string' ||
        !/^[1-9]\d{0,18}$/.test(requested) ||
        BigInt(requested) > 9223372036854775807n)
    )
      fail('invalid_tool_input');
    // Limit both root rows and keys before hydrating relations. No all=true query is executed here.
    const providers = await context.manager.getRepository(AiProvider).find({
      ...(typeof requested === 'string' ? { where: { id: requested } } : {}),
      relations: { catalog: true },
      order: { id: 'ASC' },
      take: maxRows! + 1,
    });
    if (providers.length > maxRows!) fail('context_limit');
    if (requested && providers.length !== 1) fail('resource_unavailable');
    const keys = providers.length
      ? await context.manager.getRepository(AiApiKey).find({
          where: { provider_id: In(providers.map((provider) => provider.id)) },
          order: { id: 'ASC' },
          take: maxKeys! + 1,
          select: {
            id: true,
            provider_id: true,
            label: true,
            display_hint: true,
            sort_order: true,
            is_selected: true,
            is_active: true,
            health_state: true,
            cooldown_until: true,
            last_success_at: true,
            last_error_at: true,
            last_error_code: true,
            updated_at: true,
            secret_ciphertext: true,
          },
        })
      : [];
    if (keys.length > maxKeys!) fail('context_limit');
    for (const provider of providers)
      provider.api_keys = keys.filter((key) => key.provider_id === provider.id);
    if (operation === 'codex' && providers[0]?.catalog?.key !== 'openai')
      fail('invalid_tool_input');
    const snapshot = providers.map((provider) => ({
      ...provider,
      key: provider.key ?? null,
      mode: provider.mode,
    }));
    const fingerprint = createHash('sha256')
      .update(canonicalKnowledge(JSON.parse(JSON.stringify(snapshot))))
      .digest('hex');
    return { providers, fingerprint };
  }

  async prepare(
    operation: ExternalReadOperation,
    input: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ): Promise<NodiaAiPreparedToolOperation> {
    const { providers, fingerprint } = await this.snapshot(
      operation,
      input,
      context,
    );
    const service = this.service(context);
    const secrets = new Map<string, string | null>();
    if (operation === 'models' || operation === 'eligible') {
      for (const provider of providers)
        if (provider.is_active && provider.use_api_key)
          secrets.set(
            provider.id,
            await service.getActiveApiKeySecret(provider.id, provider.api_keys),
          );
    }
    let disposed = false;
    return {
      fingerprint,
      verify: async (fresh) => {
        if (
          (await this.snapshot(operation, input, fresh)).fingerprint !==
          fingerprint
        )
          fail('capability_denied');
      },
      discard: async () => {
        disposed = true;
        secrets.clear();
      },
      execute: async (signal) => {
        if (disposed) fail('capability_denied');
        signal.throwIfAborted();
        const execution: ProviderReadExecution = {
          providers,
          signal,
          selectedSecret: async (id) => secrets.get(id) ?? null,
        };
        let output: NodiaAiJsonObject;
        if (operation === 'engines')
          output = {
            engines: engines(
              await this.ports.gemini.getDualEngineStatus(signal),
            ),
          };
        else if (operation === 'health') {
          const observed = await new GetAiProvidersHealthUseCase(
            service,
            this.ports.gemini,
            this.ports.codex,
          ).execute(execution);
          output = {
            timestamp: observed.timestamp,
            overall_status: observed.overallStatus,
            engines: engines(observed.engines),
            providers: observed.providers.map((provider) => ({
              id: provider.id,
              key: provider.key,
              name: provider.name,
              is_active: provider.isActive,
              mode: provider.mode,
              status: provider.status,
              last_check: provider.lastCheck,
              latency_ms: provider.latencyMs,
              selected_model: provider.selectedModel || null,
              has_connection: provider.hasConnection,
            })),
          };
        } else if (operation === 'models') {
          const observed = await new GetSelectableModelsUseCase(
            service,
            this.ports.gemini,
            this.ports.api,
            this.ports.codex,
          ).execute(
            {
              provider_id: input.provider_id as string,
              ...(input.mode
                ? {
                    mode: input.mode as 'api_key' | 'agentic',
                  }
                : {}),
            },
            execution,
          );
          output = {
            items: observed.map((provider) => ({
              provider_id: provider.providerId,
              provider: provider.provider,
              mode: provider.mode,
              models_source: provider.models_source,
              models_observed_at: provider.models_observed_at,
              selected_model: provider.selectedModel,
              is_active: provider.isActive,
              models: provider.models.map((model) => ({
                id: model.id,
                name: model.name,
                display_name: model.displayName,
                description: model.description,
                context_window: model.contextWindow,
                capabilities: [...model.capabilities],
              })),
            })),
          };
        } else if (operation === 'codex') {
          const observed = await this.ports.codex.observe(
            input.provider_id as string,
            signal,
          );
          output = {
            provider_id: input.provider_id,
            available: observed.available,
            authenticated: observed.authenticated,
            plan_type: observed.planType,
            checked_at: observed.checkedAt,
            reason: observed.reason,
            quotas:
              observed.quotas === null
                ? null
                : observed.quotas.map((quota) => ({
                    id: quota.id,
                    name: quota.name,
                    primary:
                      quota.primary === null
                        ? null
                        : {
                            usedPercent: quota.primary.usedPercent,
                            windowDurationMins:
                              quota.primary.windowDurationMins,
                            resetsAt: quota.primary.resetsAt,
                          },
                    secondary:
                      quota.secondary === null
                        ? null
                        : {
                            usedPercent: quota.secondary.usedPercent,
                            windowDurationMins:
                              quota.secondary.windowDurationMins,
                            resetsAt: quota.secondary.resetsAt,
                          },
                  })),
            last_inference_at: observed.lastInferenceAt,
            usage_allowed: observed.usageAllowed,
          };
        } else {
          const observed = await new VerifyIaProvidersUseCase(
            this.ports.gemini,
            service,
            this.ports.api,
            this.ports.codex,
          ).execute(execution);
          output = {
            items: observed.map((provider) => ({
              id: provider.id,
              key: provider.key,
              name: provider.name,
              mode: provider.mode,
              active_mode: provider.active_mode ?? null,
              is_active: provider.is_active,
              is_default: value(record(provider), 'is_default'),
              can_use_model: provider.can_use_model,
              default_model: provider.default_model ?? null,
              ocr_model: provider.ocr_model ?? null,
              supports_thinking: value(record(provider), 'supports_thinking'),
              extended_thinking_enabled: value(
                record(provider),
                'extended_thinking_enabled',
              ),
              eligibility_error: provider.error
                ? 'connection_not_eligible'
                : null,
            })),
          };
        }
        signal.throwIfAborted();
        return output;
      },
    };
  }
}
