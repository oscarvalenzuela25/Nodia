import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { type ActorReference } from '../../authorization/authority-transaction.js';
import { validateCatalogId } from '../../common/dto/catalog-id.dto.js';
import { TranslationService } from '../../translation/translation.service.js';
import { CreateAiProviderDto } from '../dto/create-ai-provider.dto.js';
import { UpdateAiProviderDto } from '../dto/update-ai-provider.dto.js';
import { AiProvider } from '../entities/ai-provider.entity.js';
import { AiProviderCatalog } from '../entities/ai-provider-catalog.entity.js';
import { sanitizeProviderFields } from '../helpers/supported-providers.helper.js';
import {
  resolveAiProviderCreate,
  resolveAiProviderUpdate,
} from './ai-provider-configuration.rules.js';
import { runAiProviderConfigurationTransaction } from './ai-provider-configuration-transaction.js';

@Injectable()
export class SaveAiProviderConfigurationUseCase {
  constructor(
    private readonly source: DataSource,
    private readonly translations: TranslationService,
  ) {}

  async execute(
    id: string | undefined,
    dto: CreateAiProviderDto | UpdateAiProviderDto,
    actor: ActorReference,
  ): Promise<AiProvider> {
    if (
      dto.fields === null ||
      [
        'use_api_key',
        'use_agentic',
        'auto_rotate_api_keys',
        'is_default',
        'is_active',
      ].some((key) => (dto as Record<string, unknown>)[key] === null)
    )
      throw new BadRequestException('ai_provider:invalid_configuration');
    const checked = plainToInstance(
      id ? UpdateAiProviderDto : CreateAiProviderDto,
      dto,
    );
    if (
      validateSync(checked, { whitelist: true, forbidNonWhitelisted: true })
        .length
    )
      throw new BadRequestException('ai_provider:invalid_configuration');
    if (id !== undefined) validateCatalogId(id, 'ai_provider:invalid_id');
    if (dto.catalog_id != null)
      validateCatalogId(dto.catalog_id, 'ai_provider:invalid_catalog_id');
    return runAiProviderConfigurationTransaction(
      this.source,
      actor,
      async (manager) => {
        const repo = manager.getRepository(AiProvider);
        const catalogs = manager.getRepository(AiProviderCatalog);
        const existing = id
          ? await repo.findOne({ where: { id }, relations: { catalog: true } })
          : null;
        if (id && !existing)
          throw new NotFoundException('ai_provider:not_found');
        const catalogId = existing?.catalog_id ?? dto.catalog_id;
        const catalog = catalogId
          ? await catalogs.findOneBy({ id: catalogId })
          : dto.key
            ? await catalogs.findOneBy({ key: dto.key })
            : null;
        const fields = existing
          ? resolveAiProviderUpdate(dto, existing, catalog)
          : resolveAiProviderCreate(dto, catalog, await repo.count());
        if (fields.is_default === true) {
          const query = repo
            .createQueryBuilder()
            .update(AiProvider)
            .set({ is_default: false })
            .where('is_default = :isDefault', { isDefault: true });
          if (id) query.andWhere('id != :id', { id });
          await query.execute();
        }
        const saved = await repo.save(repo.create({ ...existing, ...fields }));
        await this.translations.updateTranslations(
          'ai_providers',
          saved.id,
          dto.translates,
          manager,
        );
        const result = await repo.findOneOrFail({
          where: { id: saved.id },
          relations: { catalog: true, api_keys: true },
        });
        const translated = await this.translations.attachTranslationsToOne(
          'ai_providers',
          result,
          manager,
        );
        return sanitizeProviderFields(translated);
      },
    );
  }
}
