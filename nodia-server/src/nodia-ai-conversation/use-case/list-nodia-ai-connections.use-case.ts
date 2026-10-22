import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import type { NodiaAiSelection } from '../types/nodia-ai-persistence.types.js';
import {
  NodiaAiConnectionsService,
  type NodiaAiConnectionConfiguration,
} from '../nodia-ai-connections.service.js';
import { NodiaAiPageQueryDto } from '../dto/nodia-ai-conversation-query.dto.js';
import { validateNodiaAiDto } from '../dto/nodia-ai-validation.js';
import {
  cursorScope,
  decodeCursor,
  encodeCursor,
} from './nodia-ai-pagination.js';

export function configurationRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function identifier(value: unknown, maximum: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    Buffer.byteLength(value, 'utf8') <= maximum
  );
}
const modes = ['api_key', 'token_plan_web', 'token_plan_agentic'] as const;
/** Own selector transport bound; independent from provider quotas and model context limits. */
export const NODIA_AI_CONNECTION_PAGE_UTF8_BYTES = 1024 * 1024;
function effortPreferences(preferred: unknown) {
  // ai-provider-feature-contract.md: these are configurable preferences for all three modes,
  // not discovered capabilities. Only an exact non-generative eligibility observation enables execution.
  const options = new Set(['low', 'medium', 'high']);
  if (identifier(preferred, 256)) options.add(preferred);
  return Array.from(options, (effort_id) => ({ effort_id, label: effort_id }));
}
export function projectNodiaAiConnection(row: NodiaAiConnectionConfiguration) {
  const fields = configurationRecord(row.fields);
  return {
    connection_id: row.id,
    label: row.label,
    provider_key: row.provider_key,
    is_active: row.is_active && row.catalog_active,
    modes: modes.map((mode) => {
      const modeFields = configurationRecord(fields[mode]);
      const selected = identifier(modeFields.selected_model, 1024)
        ? modeFields.selected_model
        : null;
      const levels = configurationRecord(modeFields.thinking_levels);
      const rawEffort =
        selected && Object.hasOwn(levels, selected)
          ? levels[selected]
          : (modeFields.thinking_level ?? null);
      const validEffort = rawEffort === null || identifier(rawEffort, 256);
      const configuredSelection: NodiaAiSelection | null =
        selected && validEffort
          ? {
              connection_id: row.id,
              mode,
              model_id: selected,
              effort_id: rawEffort as string | null,
            }
          : null;
      const enabled =
        row.is_active &&
        row.catalog_active &&
        row[`use_${mode}`] === true &&
        row[`can_use_${mode}`] === true;
      const modelMap = new Map<
        string,
        {
          model_id: string;
          label: string;
          efforts: Array<{ effort_id: string; label: string }>;
        }
      >();
      // Runtime-owned response bound, not a provider quota. Never hide valid models by silently truncating them.
      if (
        Array.isArray(modeFields.available_models) &&
        modeFields.available_models.length > 200
      )
        throw new ServiceUnavailableException(
          'nodia_ai:connection_catalog_too_large',
        );
      const savedModels = Array.isArray(modeFields.available_models)
        ? modeFields.available_models
        : [];
      for (const raw of savedModels) {
        const model = configurationRecord(raw);
        if (!identifier(model.id, 1024) || modelMap.has(model.id)) continue;
        const preferred = Object.hasOwn(levels, model.id)
          ? levels[model.id]
          : modeFields.thinking_level;
        modelMap.set(model.id, {
          model_id: model.id,
          label: identifier(model.displayName, 1024)
            ? model.displayName
            : identifier(model.name, 1024)
              ? model.name
              : model.id,
          efforts: effortPreferences(preferred),
        });
      }
      if (selected && !modelMap.has(selected))
        modelMap.set(selected, {
          model_id: selected,
          label: selected,
          efforts: effortPreferences(rawEffort),
        });
      return {
        mode,
        configuration: !enabled
          ? ('disabled' as const)
          : configuredSelection
            ? ('configured' as const)
            : ('incomplete' as const),
        authentication: 'unknown' as const,
        inference: 'unknown' as const,
        tools:
          mode === 'token_plan_web' ||
          mode === 'api_key' ||
          row.provider_key !== 'gemini'
            ? ('unsupported' as const)
            : ('unknown' as const),
        observed_at: null,
        block_reason: null,
        configured_selection: configuredSelection,
        models: Array.from(modelMap.values()),
      };
    }),
  };
}

@Injectable()
export class ListNodiaAiConnectionsUseCase {
  constructor(
    private readonly connections: NodiaAiConnectionsService,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(identity: NodiaAiActorReference, input: unknown) {
    const query = validateNodiaAiDto(NodiaAiPageQueryDto, input);
    const limit = query.page_limit ?? this.policy.results.list_default_rows;
    if (limit > this.policy.results.list_max_rows)
      throw new BadRequestException('nodia_ai:invalid_input');
    return this.connections.transaction(async (manager) => {
      await lockAuthority(manager);
      const actor = await this.authorize.execute(identity, {}, manager);
      const scope = cursorScope({
        kind: 'connections',
        actor: actor.actorId,
        session: actor.sessionId,
      });
      const cursor = decodeCursor(query.cursor, scope);
      if (
        cursor &&
        (cursor.length !== 1 ||
          !/^[1-9]\d{0,18}$/.test(cursor[0]) ||
          BigInt(cursor[0]) > 9223372036854775807n)
      )
        throw new BadRequestException('nodia_ai:invalid_cursor');
      const rows = await this.connections.list(
        manager,
        cursor?.[0] ?? null,
        limit,
      );
      const visible = rows.slice(0, limit);
      const items: ReturnType<typeof projectNodiaAiConnection>[] = [];
      // Reserve envelope/cursor space; each connection remains whole and cursors never skip a connection.
      let bytes = 4096;
      for (const row of visible) {
        const item = projectNodiaAiConnection(row);
        const itemBytes = Buffer.byteLength(JSON.stringify(item), 'utf8') + 1;
        if (bytes + itemBytes > NODIA_AI_CONNECTION_PAGE_UTF8_BYTES) {
          if (items.length === 0)
            throw new ServiceUnavailableException(
              'nodia_ai:connection_catalog_too_large',
            );
          break;
        }
        items.push(item);
        bytes += itemBytes;
      }
      return {
        items,
        next_cursor:
          rows.length > items.length
            ? encodeCursor(scope, [items.at(-1)!.connection_id])
            : null,
      };
    });
  }
}
