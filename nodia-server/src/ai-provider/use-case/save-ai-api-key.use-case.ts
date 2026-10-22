import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { DataSource, type EntityManager } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { validateCatalogId } from '../../common/dto/catalog-id.dto.js';
import { CreateAiApiKeyDto } from '../dto/create-ai-api-key.dto.js';
import { UpdateAiApiKeyDto } from '../dto/update-ai-api-key.dto.js';
import { AiApiKey } from '../entities/ai-api-key.entity.js';
import { AiProvider } from '../entities/ai-provider.entity.js';
import { AiProviderCatalog } from '../entities/ai-provider-catalog.entity.js';
import {
  encryptSecret,
  generateDisplayHint,
  generateFingerprint,
} from '../helpers/ai-key-crypto.helper.js';
import { runAiProviderConfigurationTransaction } from './ai-provider-configuration-transaction.js';

/** Only an authenticated human transport may receive this projection. */
export type SafeAiApiKey = Pick<
  AiApiKey,
  | 'id'
  | 'provider_id'
  | 'label'
  | 'display_hint'
  | 'sort_order'
  | 'is_selected'
  | 'health_state'
  | 'is_active'
  | 'last_error_code'
  | 'last_error_message'
  | 'last_error_at'
  | 'last_success_at'
  | 'cooldown_until'
  | 'created_at'
  | 'updated_at'
>;

export function publicAiApiKey(key: AiApiKey): SafeAiApiKey {
  return {
    id: key.id,
    provider_id: key.provider_id,
    label: key.label,
    display_hint: key.display_hint,
    sort_order: key.sort_order,
    is_selected: key.is_selected,
    health_state: key.health_state,
    is_active: key.is_active,
    last_error_code: key.last_error_code,
    last_error_message: key.last_error_message,
    last_error_at: key.last_error_at,
    last_success_at: key.last_success_at,
    cooldown_until: key.cooldown_until,
    created_at: key.created_at,
    updated_at: key.updated_at,
  };
}

@Injectable()
export class SaveAiApiKeyUseCase {
  constructor(private readonly source: DataSource) {}

  private async key(manager: EntityManager, id: string): Promise<AiApiKey> {
    const key = await manager.getRepository(AiApiKey).findOneBy({ id });
    if (!key) throw new NotFoundException('ai_provider:api_key_not_found');
    return key;
  }

  async execute(
    id: string | undefined,
    dto: CreateAiApiKeyDto | UpdateAiApiKeyDto,
    actor: ActorReference,
  ): Promise<SafeAiApiKey> {
    if (id !== undefined)
      validateCatalogId(id, 'ai_provider:invalid_api_key_id');
    if (
      !dto ||
      typeof dto !== 'object' ||
      Object.values(dto).some((value) => value === null)
    )
      throw new BadRequestException('ai_provider:invalid_api_key');
    const checked = id
      ? plainToInstance(UpdateAiApiKeyDto, dto)
      : plainToInstance(CreateAiApiKeyDto, dto);
    if (
      validateSync(checked, { whitelist: true, forbidNonWhitelisted: true })
        .length
    )
      throw new BadRequestException('ai_provider:invalid_api_key');
    if ('provider_id' in dto)
      validateCatalogId(dto.provider_id, 'ai_provider:invalid_id');
    try {
      return await runAiProviderConfigurationTransaction(
        this.source,
        actor,
        async (manager) => {
          const repo = manager.getRepository(AiApiKey);
          // The configuration frontier serializes native writers before resolving an existing key.
          const current = id ? await this.key(manager, id) : null;
          const providerId =
            current?.provider_id ?? (dto as CreateAiApiKeyDto).provider_id;
          const provider = await manager.getRepository(AiProvider).findOne({
            where: { id: providerId },
            lock: { mode: 'pessimistic_write' },
          });
          if (!provider) throw new NotFoundException('ai_provider:not_found');
          const catalog = provider.catalog_id
            ? await manager
                .getRepository(AiProviderCatalog)
                .findOneBy({ id: provider.catalog_id })
            : null;
          if (!current && catalog?.can_use_api_key !== true)
            throw new BadRequestException('El catálogo no permite API keys.');
          const { secret, ...fields } = dto;
          const change = { ...fields };
          const active = change.is_active ?? current?.is_active ?? true;
          if (!current && !active) change.is_selected = false;
          if (change.is_selected && !active)
            throw new BadRequestException(
              'No se puede seleccionar una API key inactiva.',
            );
          // Count active keys, not inactive historical rows. A sole active key always wins.
          const activeKeys = await repo.countBy({
            provider_id: providerId,
            is_active: true,
          });
          const otherActive = activeKeys - (current?.is_active ? 1 : 0);
          if (!active) change.is_selected = false;
          else if (otherActive === 0) change.is_selected = true;
          if (change.is_selected)
            await repo.update(
              { provider_id: providerId, is_selected: true },
              { is_selected: false },
            );
          const encrypted =
            secret === undefined
              ? {}
              : {
                  secret_ciphertext: encryptSecret(secret),
                  secret_fingerprint: generateFingerprint(secret),
                  display_hint: generateDisplayHint(secret),
                };
          const result = await repo.save(
            repo.create({
              ...current,
              ...change,
              ...encrypted,
              provider_id: providerId,
            }),
          );
          // Deactivating a selected key may leave one active key among inactive history.
          if (!active) await this.normalizeSoleActive(manager, providerId);
          return publicAiApiKey(result);
        },
      );
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === '23505'
      )
        throw new ConflictException(
          'Esta API key ya está registrada en la conexión.',
        );
      throw error;
    }
  }

  private async normalizeSoleActive(
    manager: EntityManager,
    providerId: string,
  ): Promise<void> {
    const repo = manager.getRepository(AiApiKey);
    const remaining = await repo.find({
      where: { provider_id: providerId, is_active: true },
      take: 2,
    });
    if (remaining.length === 1)
      await repo.update({ id: remaining[0].id }, { is_selected: true });
  }

  async remove(id: string, actor: ActorReference): Promise<void> {
    validateCatalogId(id, 'ai_provider:invalid_api_key_id');
    return runAiProviderConfigurationTransaction(
      this.source,
      actor,
      async (manager) => {
        const key = await this.key(manager, id);
        await manager
          .getRepository(AiProvider)
          .findOneOrFail({
            where: { id: key.provider_id },
            lock: { mode: 'pessimistic_write' },
          });
        await manager
          .getRepository(AiApiKey)
          .delete({ id, provider_id: key.provider_id });
        await this.normalizeSoleActive(manager, key.provider_id);
      },
    );
  }
}
