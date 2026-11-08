import { BadRequestException } from '@nestjs/common';
import type { CreateAiProviderDto } from '../dto/create-ai-provider.dto.js';
import type { UpdateAiProviderDto } from '../dto/update-ai-provider.dto.js';
import type { AiProvider } from '../entities/ai-provider.entity.js';
import type { AiProviderCatalog } from '../entities/ai-provider-catalog.entity.js';
import { getSupportedProviderByKey } from '../helpers/supported-providers.helper.js';
const modes = ['api_key', 'agentic'] as const;
/** Retired channels cannot be reintroduced through arbitrary configuration JSON. */
function validateFields(value: Record<string, unknown> | undefined): void {
  if (!value) return;
  if (
    ['token_plan_web', 'token_plan_agentic'].some((key) =>
      Object.hasOwn(value, key),
    )
  )
    throw new BadRequestException('ai_provider:retired_mode');
}
export function validateAiProviderCatalogPolicy(
  _key: string,
  patch: object,
): void {
  if (
    Object.hasOwn(patch, 'can_use_token_plan_web') ||
    Object.hasOwn(patch, 'can_use_token_plan_agentic')
  )
    throw new BadRequestException('ai_provider:retired_mode');
}
function validateChannels(
  value: Partial<AiProvider>,
  catalog: AiProviderCatalog | null,
) {
  for (const [enabled, permitted] of [
    ['use_api_key', 'can_use_api_key'],
    ['use_agentic', 'can_use_agentic'],
  ] as const)
    if (value[enabled] && catalog && !catalog[permitted])
      throw new BadRequestException('ai_provider:channel_not_allowed');
  if (
    value.default_mode &&
    (!modes.includes(value.default_mode) || !value[`use_${value.default_mode}`])
  )
    throw new BadRequestException('ai_provider:default_mode_disabled');
}
export function resolveAiProviderCreate(
  dto: CreateAiProviderDto,
  catalog: AiProviderCatalog | null,
  existingCount: number,
): Partial<AiProvider> {
  validateFields(dto.fields);
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
    Object.entries(rest).filter(([, v]) => v !== undefined),
  );
  const fields: Record<string, unknown> = {
    ...dto.fields,
    available_models: [],
  };
  for (const key of ['selected_model', 'ocr_model', 'ocr_focus_model'])
    delete fields[key];
  const api = dto.use_api_key ?? false,
    agentic = dto.use_agentic ?? false;
  const result: Partial<AiProvider> = {
    ...provided,
    catalog_id: catalog.id,
    name: dto.name || catalog.name || catalog.key,
    auto_rotate_api_keys: dto.auto_rotate_api_keys ?? true,
    is_active: dto.is_active ?? true,
    fields,
    use_api_key: api,
    use_agentic: agentic,
    default_mode:
      dto.default_mode !== undefined
        ? dto.default_mode
        : agentic
          ? 'agentic'
          : api
            ? 'api_key'
            : null,
    is_default: dto.is_default ?? existingCount === 0,
  };
  validateChannels(result, catalog);
  return result;
}
export function resolveAiProviderUpdate(
  dto: UpdateAiProviderDto,
  existing: AiProvider,
  catalog: AiProviderCatalog | null,
): Partial<AiProvider> {
  validateFields(dto.fields);
  if (dto.catalog_id && dto.catalog_id !== existing.catalog_id)
    throw new BadRequestException(
      'El proveedor de catálogo de una conexión no se puede cambiar.',
    );
  const { key: _key, mode: _mode, translates: _translates, ...rest } = dto;
  const provided = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== undefined),
  );
  const result: Partial<AiProvider> = {
    ...provided,
    catalog_id: existing.catalog_id,
    name: dto.name ?? existing.name,
  };
  if (dto.fields !== undefined) {
    const previous: Record<string, unknown> = { ...existing.fields };
    const hasScoped = modes.some((mode) => previous[mode]);
    const introduces = modes.some((mode) => dto.fields?.[mode]);
    const original = existing.default_mode;
    if (!hasScoped && introduces && original) {
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
        if (Object.hasOwn(previous, key)) legacy[key] = previous[key];
      previous[original] = legacy;
    }
    const fields: Record<string, unknown> = { ...previous, ...dto.fields };
    for (const mode of modes) {
      const patch: unknown = dto.fields[mode],
        old: unknown = previous[mode];
      if (
        patch &&
        typeof patch === 'object' &&
        !Array.isArray(patch) &&
        old &&
        typeof old === 'object' &&
        !Array.isArray(old)
      ) {
        const merged: Record<string, unknown> = { ...old, ...patch };
        const levels = (patch as Record<string, unknown>).thinking_levels,
          oldLevels = (old as Record<string, unknown>).thinking_levels;
        if (
          levels &&
          typeof levels === 'object' &&
          !Array.isArray(levels) &&
          oldLevels &&
          typeof oldLevels === 'object' &&
          !Array.isArray(oldLevels)
        )
          merged.thinking_levels = { ...oldLevels, ...levels };
        fields[mode] = merged;
      }
    }
    result.fields = fields;
  }
  validateChannels({ ...existing, ...result }, catalog);
  return result;
}
