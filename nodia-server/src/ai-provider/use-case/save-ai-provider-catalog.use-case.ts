import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { DataSource } from 'typeorm';
import { type ActorReference } from '../../authorization/authority-transaction.js';
import { validateCatalogId } from '../../common/dto/catalog-id.dto.js';
import { CreateAiProviderCatalogDto } from '../dto/create-ai-provider-catalog.dto.js';
import { UpdateAiProviderCatalogDto } from '../dto/update-ai-provider-catalog.dto.js';
import { AiProviderCatalog } from '../entities/ai-provider-catalog.entity.js';
import { runAiProviderConfigurationTransaction } from './ai-provider-configuration-transaction.js';
import { validateAiProviderCatalogPolicy } from './ai-provider-configuration.rules.js';

@Injectable()
export class SaveAiProviderCatalogUseCase {
  constructor(private readonly source: DataSource) {}
  async execute(
    id: string | undefined,
    dto: CreateAiProviderCatalogDto | UpdateAiProviderCatalogDto,
    actor: ActorReference,
  ): Promise<AiProviderCatalog> {
    if (
      [
        'can_use_api_key',
        'can_use_token_plan_web',
        'can_use_token_plan_agentic',
        'is_active',
      ].some((key) => (dto as unknown as Record<string, unknown>)[key] === null)
    )
      throw new BadRequestException('ai_provider:invalid_catalog');
    const checked = id
      ? plainToInstance(UpdateAiProviderCatalogDto, dto)
      : plainToInstance(CreateAiProviderCatalogDto, dto);
    if (
      validateSync(checked, { whitelist: true, forbidNonWhitelisted: true })
        .length
    )
      throw new BadRequestException('ai_provider:invalid_catalog');
    if (id !== undefined) validateCatalogId(id, 'ai_provider:invalid_id');
    // ES2023 DTO fields exist as own undefined properties; omission remains a no-op.
    const command = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    ) as typeof dto;
    return runAiProviderConfigurationTransaction(
      this.source,
      actor,
      async (manager) => {
        const repo = manager.getRepository(AiProviderCatalog);
        const existing = id ? await repo.findOneBy({ id }) : null;
        if (id && !existing)
          throw new NotFoundException('ai_provider:catalog_not_found');
        if (!id) {
          const input = command as CreateAiProviderCatalogDto;
          const key = input.key.trim().toLowerCase();
          validateAiProviderCatalogPolicy(key, input);
          if (!key)
            throw new BadRequestException('ai_provider:invalid_catalog');
          if (await repo.findOneBy({ key }))
            throw new ConflictException('ai_provider:catalog_key_exists');
          return repo.save(repo.create({ ...input, key }));
        }
        validateAiProviderCatalogPolicy(existing!.key, command);
        return repo.save(repo.create({ ...existing, ...command }));
      },
    );
  }
}
