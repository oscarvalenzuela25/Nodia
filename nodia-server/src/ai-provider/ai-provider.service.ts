import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiProvider } from './entities/ai-provider.entity.js';
import { AiApiKey } from './entities/ai-api-key.entity.js';
import { AiProviderEvent } from './entities/ai-provider-event.entity.js';
import { AiProviderCatalog } from './entities/ai-provider-catalog.entity.js';
import { GetAiProvidersDto } from './dto/get-ai-providers.dto.js';
import { GetAiApiKeysDto } from './dto/get-ai-api-keys.dto.js';
import { CreateAiProviderEventDto } from './dto/create-ai-provider-event.dto.js';
import { GetAiProviderEventsDto } from './dto/get-ai-provider-events.dto.js';
import {
  GetAiProvidersResponse,
  GetAiApiKeysResponse,
  GetAiProviderEventsResponse,
} from './types/ai-provider.types.js';
import {
  applyRansack,
  validateRansackEnvelope,
} from '../common/utils/ransack-query.builder.js';
import { RANSACK_POLICIES } from '../common/utils/ransack-query.policies.js';
import { TranslationService } from '../translation/translation.service.js';
import { decryptSecret } from './helpers/ai-key-crypto.helper.js';
import { sanitizeProviderFields } from './helpers/supported-providers.helper.js';
import { resolveAiProviderUpdate } from './use-case/ai-provider-configuration.rules.js';
import type { DiscoveredModelInfo } from './use-case/sync-ai-provider-models.use-case.js';

@Injectable()
export class AiProviderService {
  constructor(
    @InjectRepository(AiProvider)
    private readonly aiProviderRepository: Repository<AiProvider>,
    @InjectRepository(AiApiKey)
    private readonly aiApiKeyRepository: Repository<AiApiKey>,
    @InjectRepository(AiProviderEvent)
    private readonly aiProviderEventRepository: Repository<AiProviderEvent>,
    @InjectRepository(AiProviderCatalog)
    private readonly aiProviderCatalogRepository: Repository<AiProviderCatalog>,
    private readonly translationService: TranslationService,
  ) {}

  // ===========================================================================
  // AI PROVIDERS
  // ===========================================================================

  async findAllProviders({
    page = 1,
    limit = 10,
    all = false,
    includes = true,
    q,
  }: GetAiProvidersDto): Promise<GetAiProvidersResponse> {
    const qb = this.aiProviderRepository.createQueryBuilder('ai_provider');
    validateRansackEnvelope(q);

    if (includes) {
      qb.leftJoinAndSelect('ai_provider.catalog', 'catalog');
      qb.leftJoinAndSelect('ai_provider.api_keys', 'api_keys');
    } else {
      // key belongs to the catalogue, including when relation payloads are omitted.
      qb.leftJoin('ai_provider.catalog', 'catalog').addSelect([
        'catalog.id',
        'catalog.key',
      ]);
    }

    applyRansack(qb, q, 'ai_provider', RANSACK_POLICIES.ai_provider);

    qb.addOrderBy('ai_provider.is_default', 'DESC');
    qb.addOrderBy('ai_provider.id', 'ASC');

    const toPublic = (item: AiProvider) => {
      const result = sanitizeProviderFields(item);
      if (!includes) delete result.catalog;
      return result;
    };

    if (all) {
      const rawData = await qb.getMany();
      const data = await this.translationService.attachTranslations(
        'ai_providers',
        rawData,
      );
      const sanitizedData = data.map(toPublic);
      return {
        data: sanitizedData as any,
        meta: {
          page: 1,
          limit: sanitizedData.length,
          total_items: sanitizedData.length,
          total_pages: 1,
        },
      };
    }

    const [rawData, total_items] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data = await this.translationService.attachTranslations(
      'ai_providers',
      rawData,
    );
    const sanitizedData = data.map(toPublic);
    const total_pages = Math.ceil(total_items / limit);

    return {
      data: sanitizedData as any,
      meta: {
        page,
        limit,
        total_items,
        total_pages,
      },
    };
  }

  async findProviderById(id: string): Promise<AiProvider> {
    const provider = await this.aiProviderRepository.findOne({
      where: { id },
      relations: {
        catalog: true,
        api_keys: true,
      },
    });

    if (!provider) {
      throw new NotFoundException(`AiProvider with ID "${id}" not found`);
    }

    const result = (await this.translationService.attachTranslationsToOne(
      'ai_providers',
      provider,
    )) as any;
    return sanitizeProviderFields(result);
  }

  // ===========================================================================
  // AI PROVIDER CATALOG
  // ===========================================================================

  async findAllCatalogs(maxRows?: number): Promise<AiProviderCatalog[]> {
    return this.aiProviderCatalogRepository.find({
      order: { id: 'ASC' },
      ...(maxRows === undefined ? {} : { take: maxRows + 1 }),
    });
  }

  async findCatalogById(id: string): Promise<AiProviderCatalog | null> {
    return this.aiProviderCatalogRepository.findOne({ where: { id } });
  }

  async findCatalogByKey(key: string): Promise<AiProviderCatalog | null> {
    return this.aiProviderCatalogRepository.findOne({ where: { key } });
  }

  // ===========================================================================
  // AI API KEYS
  // ===========================================================================

  async findAllApiKeys({
    page = 1,
    limit = 10,
    all = false,
    includes = true,
    q,
  }: GetAiApiKeysDto): Promise<GetAiApiKeysResponse> {
    const qb = this.aiApiKeyRepository.createQueryBuilder('api_key');
    validateRansackEnvelope(q);

    if (includes) {
      qb.leftJoinAndSelect('api_key.provider', 'provider');
    }

    applyRansack(qb, q, 'api_key', RANSACK_POLICIES.api_key);
    qb.addOrderBy('api_key.sort_order', 'ASC').addOrderBy('api_key.id', 'ASC');

    if (all) {
      const rawData = await qb.getMany();
      return {
        data: rawData,
        meta: {
          page: 1,
          limit: rawData.length,
          total_items: rawData.length,
          total_pages: 1,
        },
      };
    }

    const [rawData, total_items] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const total_pages = Math.ceil(total_items / limit);

    return {
      data: rawData,
      meta: {
        page,
        limit,
        total_items,
        total_pages,
      },
    };
  }

  async findApiKeyById(id: string): Promise<AiApiKey> {
    const apiKey = await this.aiApiKeyRepository.findOne({
      where: { id },
      relations: {
        provider: true,
      },
    });

    if (!apiKey) {
      throw new NotFoundException(`AiApiKey with ID "${id}" not found`);
    }

    return apiKey;
  }

  // ===========================================================================
  // AI PROVIDER EVENTS (Immutable audit log)
  // ===========================================================================

  async findAllEvents({
    page = 1,
    limit = 10,
    all = false,
    includes = true,
    q,
  }: GetAiProviderEventsDto): Promise<GetAiProviderEventsResponse> {
    const qb = this.aiProviderEventRepository.createQueryBuilder('event');
    validateRansackEnvelope(q);

    if (includes) {
      qb.leftJoinAndSelect('event.provider', 'provider')
        .leftJoinAndSelect('event.api_key', 'api_key')
        .leftJoinAndSelect('event.actor_user', 'actor_user');
    }

    applyRansack(qb, q, 'event', RANSACK_POLICIES.event);

    if (!q?.s) {
      qb.orderBy('event.created_at', 'DESC');
    }
    qb.addOrderBy('event.id', 'DESC');

    if (all) {
      const rawData = await qb.getMany();
      return {
        data: rawData,
        meta: {
          page: 1,
          limit: rawData.length,
          total_items: rawData.length,
          total_pages: 1,
        },
      };
    }

    const [rawData, total_items] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const total_pages = Math.ceil(total_items / limit);

    return {
      data: rawData,
      meta: {
        page,
        limit,
        total_items,
        total_pages,
      },
    };
  }

  async createEvent(
    createDto: CreateAiProviderEventDto,
  ): Promise<AiProviderEvent> {
    const event = this.aiProviderEventRepository.create(createDto);
    return this.aiProviderEventRepository.save(event);
  }

  async getEligibleApiKeySecrets(
    providerId: string,
    rotate = false,
    snapshotKeys?: readonly AiApiKey[],
  ): Promise<string[]> {
    const now = new Date();
    const qb = snapshotKeys
      ? undefined
      : this.aiApiKeyRepository
          .createQueryBuilder('key')
          .addSelect('key.secret_ciphertext')
          .where('key.provider_id = :providerId', { providerId })
          .andWhere('key.is_active = true')
          .andWhere(
            '(key.cooldown_until IS NULL OR key.cooldown_until <= :now)',
            { now },
          )
          .orderBy('key.is_selected', 'DESC')
          .addOrderBy('key.sort_order', 'ASC')
          .addOrderBy('key.id', 'ASC');
    if (!rotate) qb?.andWhere('key.is_selected = true');
    const rows = snapshotKeys ?? (await qb!.take(rotate ? 20 : 1).getMany());
    // Shared policy for a live SQL selection or an already bounded internal snapshot.
    const entities = rows
      .filter(
        (key) =>
          key.provider_id === providerId &&
          key.is_active &&
          (key.cooldown_until == null ||
            new Date(key.cooldown_until).getTime() <= now.getTime()) &&
          (rotate || key.is_selected),
      )
      .sort(
        (a, b) =>
          Number(b.is_selected) - Number(a.is_selected) ||
          a.sort_order - b.sort_order ||
          (BigInt(a.id) < BigInt(b.id)
            ? -1
            : BigInt(a.id) > BigInt(b.id)
              ? 1
              : 0),
      )
      .slice(0, rotate ? 20 : 1);
    try {
      return entities.map((key) => decryptSecret(key.secret_ciphertext));
    } catch {
      throw new BadRequestException(
        'No se pudo descifrar la API key configurada. Revise la configuración de cifrado.',
      );
    }
  }

  async getActiveApiKeySecret(
    providerId: string,
    snapshotKeys?: readonly AiApiKey[],
  ): Promise<string | null> {
    return (
      (
        await this.getEligibleApiKeySecrets(providerId, false, snapshotKeys)
      )[0] ?? null
    );
  }

  /** Persist only observations after remote I/O; never replay its stale configuration snapshot. */
  async mergeDiscoveredModels(
    id: string,
    mode: 'api_key' | 'token_plan_web' | 'token_plan_agentic',
    models: readonly DiscoveredModelInfo[],
  ): Promise<void> {
    await this.aiProviderRepository.manager.transaction(async (manager) => {
      await manager.query("SET LOCAL lock_timeout = '2s'");
      await manager.query("SET LOCAL statement_timeout = '5s'");
      await manager.query(
        'LOCK TABLE ai_provider_catalog, ai_providers IN SHARE ROW EXCLUSIVE MODE',
      );
      const repository = manager.getRepository(AiProvider);
      const current = await repository.findOneOrFail({
        where: { id },
        relations: { catalog: true },
      });
      const resolved = resolveAiProviderUpdate(
        { fields: { [mode]: { available_models: models } } },
        current,
        current.catalog ?? null,
      );
      await repository.update(id, { fields: resolved.fields });
    });
  }
}
