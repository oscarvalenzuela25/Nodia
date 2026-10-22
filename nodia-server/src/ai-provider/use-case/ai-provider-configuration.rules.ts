import { BadRequestException } from '@nestjs/common';
import type { CreateAiProviderDto } from '../dto/create-ai-provider.dto.js';
import type { UpdateAiProviderDto } from '../dto/update-ai-provider.dto.js';
import type { AiProvider } from '../entities/ai-provider.entity.js';
import type { AiProviderCatalog } from '../entities/ai-provider-catalog.entity.js';
import { getSupportedProviderByKey } from '../helpers/supported-providers.helper.js';

/** ChatGPT Web was explicitly withdrawn; historical omitted flags remain readable. */
export function validateAiProviderCatalogPolicy(
  key: string,
  patch: { can_use_token_plan_web?: boolean },
): void {
  if (
    key.trim().toLowerCase() === 'openai' &&
    patch.can_use_token_plan_web === true
  )
    throw new BadRequestException('ai_provider:web_integration_disabled');
}

function validateConnectionWebPolicy(
  dto: CreateAiProviderDto | UpdateAiProviderDto,
  catalog: AiProviderCatalog | null,
) {
  if (
    catalog?.key.trim().toLowerCase() === 'openai' &&
    dto.use_token_plan_web === true
  )
    throw new BadRequestException('ai_provider:web_integration_disabled');
}

function validateChannels(
  value: Partial<AiProvider>,
  catalog: AiProviderCatalog | null,
) {
  for (const [enabled, permitted] of [
    ['use_api_key', 'can_use_api_key'],
    ['use_token_plan_web', 'can_use_token_plan_web'],
    ['use_token_plan_agentic', 'can_use_token_plan_agentic'],
  ] as const) {
    if (value[enabled] && catalog && !catalog[permitted])
      throw new BadRequestException('ai_provider:channel_not_allowed');
  }
  const enabled =
    value.default_mode === 'api_key'
      ? value.use_api_key
      : value.default_mode === 'token_plan_web'
        ? value.use_token_plan_web
        : value.default_mode === 'token_plan_agentic'
          ? value.use_token_plan_agentic
          : true;
  if (!enabled)
    throw new BadRequestException('ai_provider:default_mode_disabled');
}

/** Configuration only: catalog flags never prove a working session or model. */
export function resolveAiProviderCreate(
  dto: CreateAiProviderDto,
  catalog: AiProviderCatalog | null,
  existingCount: number,
): Partial<AiProvider> {
  validateConnectionWebPolicy(dto, catalog);
  if (!catalog || !catalog.is_active)
    throw new BadRequestException(
      'Seleccione un proveedor activo del catálogo.',
    );
  if (!getSupportedProviderByKey(catalog.key))
    throw new BadRequestException(
      'Este proveedor no tiene una integración implementada.',
    );
  const { key: _key, mode: _mode, translates: _translates, ...rest } = dto;
  const provided = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined),
  );
  const fields: Record<string, unknown> = {
    ...dto.fields,
    available_models: [],
  };
  for (const key of ['selected_model', 'ocr_model', 'ocr_focus_model'])
    delete fields[key];
  const useApi = dto.use_api_key ?? false;
  const useWeb = dto.use_token_plan_web ?? false;
  const useAgentic = dto.use_token_plan_agentic ?? false;
  const result: Partial<AiProvider> = {
    ...provided,
    catalog_id: catalog.id,
    name: dto.name || catalog.name || catalog.key,
    auto_rotate_api_keys: dto.auto_rotate_api_keys ?? true,
    is_active: dto.is_active ?? true,
    fields,
    use_api_key: useApi,
    use_token_plan_web: useWeb,
    use_token_plan_agentic: useAgentic,
    default_mode:
      dto.default_mode ||
      (useAgentic
        ? 'token_plan_agentic'
        : useWeb
          ? 'token_plan_web'
          : useApi
            ? 'api_key'
            : null),
    is_default: dto.is_default ?? existingCount === 0,
  };
  validateChannels(result, catalog);
  return result;
}

/** Preserve historical fields byte-for-byte unless the caller explicitly patches them. */
export function resolveAiProviderUpdate(
  dto: UpdateAiProviderDto,
  existing: AiProvider,
  catalog: AiProviderCatalog | null,
): Partial<AiProvider> {
  validateConnectionWebPolicy(dto, catalog);
  if (dto.catalog_id && dto.catalog_id !== existing.catalog_id)
    throw new BadRequestException(
      'El proveedor de catálogo de una conexión no se puede cambiar.',
    );
  const { key: _key, mode: _mode, translates: _translates, ...rest } = dto;
  const provided = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined),
  );
  const result: Partial<AiProvider> = {
    ...provided,
    catalog_id: existing.catalog_id,
    name: dto.name ?? existing.name,
  };
  if (dto.fields !== undefined) {
    const previousFields: Record<string, unknown> = { ...existing.fields };
    const modes = ['api_key', 'token_plan_web', 'token_plan_agentic'];
    const hasScoped = modes.some((mode) => previousFields[mode]);
    const introducesScoped = modes.some((mode) => dto.fields?.[mode]);
    // Old flat preferences belong to the original configured mode. Introducing
    // any scoped channel must not silently disable those existing preferences.
    const originalMode =
      existing.default_mode ??
      (existing.use_token_plan_agentic
        ? 'token_plan_agentic'
        : existing.use_token_plan_web
          ? 'token_plan_web'
          : existing.use_api_key
            ? 'api_key'
            : null);
    if (!hasScoped && introducesScoped && originalMode) {
      const legacy: Record<string, unknown> = {};
      for (const key of [
        'selected_model',
        'ocr_model',
        'ocr_focus_model',
        'thinking_level',
        'thinking_levels',
        'enable_extended_thinking',
        'available_models',
      ])
        if (Object.hasOwn(previousFields, key))
          legacy[key] = previousFields[key];
      previousFields[originalMode] = legacy;
    }
    const fields: Record<string, unknown> = {
      ...previousFields,
      ...dto.fields,
    };
    for (const mode of ['api_key', 'token_plan_web', 'token_plan_agentic']) {
      const patch: unknown = dto.fields[mode];
      const previous: unknown = previousFields[mode];
      if (
        patch &&
        typeof patch === 'object' &&
        !Array.isArray(patch) &&
        previous &&
        typeof previous === 'object' &&
        !Array.isArray(previous)
      ) {
        const merged: Record<string, unknown> = { ...previous, ...patch };
        const patchLevels: unknown = (patch as Record<string, unknown>)
          .thinking_levels;
        const oldLevels: unknown = (previous as Record<string, unknown>)
          .thinking_levels;
        if (
          patchLevels &&
          typeof patchLevels === 'object' &&
          !Array.isArray(patchLevels) &&
          oldLevels &&
          typeof oldLevels === 'object' &&
          !Array.isArray(oldLevels)
        )
          merged.thinking_levels = { ...oldLevels, ...patchLevels };
        fields[mode] = merged;
      }
    }
    result.fields = fields;
  }
  validateChannels({ ...existing, ...result }, catalog);
  return result;
}
