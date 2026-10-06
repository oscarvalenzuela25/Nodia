import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiProvider } from './entities/ai-provider.entity.js';
import { AiApiKey } from './entities/ai-api-key.entity.js';
import { AiProviderEvent } from './entities/ai-provider-event.entity.js';
import { AiProviderCatalog } from './entities/ai-provider-catalog.entity.js';
import { CreateAiProviderDto } from './dto/create-ai-provider.dto.js';
import { UpdateAiProviderDto } from './dto/update-ai-provider.dto.js';
import { GetAiProvidersDto } from './dto/get-ai-providers.dto.js';
import { CreateAiProviderCatalogDto } from './dto/create-ai-provider-catalog.dto.js';
import { UpdateAiProviderCatalogDto } from './dto/update-ai-provider-catalog.dto.js';
import { CreateAiApiKeyDto } from './dto/create-ai-api-key.dto.js';
import { UpdateAiApiKeyDto } from './dto/update-ai-api-key.dto.js';
import { GetAiApiKeysDto } from './dto/get-ai-api-keys.dto.js';
import { CreateAiProviderEventDto } from './dto/create-ai-provider-event.dto.js';
import { GetAiProviderEventsDto } from './dto/get-ai-provider-events.dto.js';
import {
  AiConnectionMode,
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
import {
  encryptSecret,
  decryptSecret,
  generateDisplayHint,
  generateFingerprint,
} from './helpers/ai-key-crypto.helper.js';
import {
  getSupportedProviderByKey,
  sanitizeProviderFields,
} from './helpers/supported-providers.helper.js';

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

  async createProvider(createDto: CreateAiProviderDto): Promise<AiProvider> {
    const { translates, ...providerData } = createDto;

    let catalog: AiProviderCatalog | null = null;
    if (providerData.catalog_id) {
      catalog = await this.aiProviderCatalogRepository.findOne({
        where: { id: providerData.catalog_id },
      });
    } else if (providerData.key) {
      catalog = await this.aiProviderCatalogRepository.findOne({
        where: { key: providerData.key },
      });
    }

    const effectiveKey = providerData.key || catalog?.key || 'unknown';
    const effectiveName = providerData.name || catalog?.name || effectiveKey;
    const supported = getSupportedProviderByKey(effectiveKey);
    let mode = providerData.mode;
    if (!mode && supported) {
      mode = supported.defaultMode;
    }

    const fields = providerData.fields ? { ...providerData.fields } : {};
    // Providers must always be created without models until explicitly synced & configured
    fields.available_models = [];
    delete fields.selected_model;
    delete fields.ocr_model;
    delete fields.ocr_focus_model;

    const useApiKey = providerData.use_api_key ?? false;
    const useWeb = providerData.use_token_plan_web ?? false;
    const useAgentic = providerData.use_token_plan_agentic ?? false;

    if (catalog) {
      if (useApiKey && !catalog.can_use_api_key) {
        throw new BadRequestException(
          `El catálogo "${catalog.name || catalog.key}" no permite habilitar el canal de API Key.`,
        );
      }
      if (useWeb && !catalog.can_use_token_plan_web) {
        throw new BadRequestException(
          `El catálogo "${catalog.name || catalog.key}" no permite habilitar el canal de Token Plan Web.`,
        );
      }
      if (useAgentic && !catalog.can_use_token_plan_agentic) {
        throw new BadRequestException(
          `El catálogo "${catalog.name || catalog.key}" no permite habilitar el canal de Token Plan Agentic.`,
        );
      }
    }

    let defaultMode = providerData.default_mode;
    if (!defaultMode) {
      if (useAgentic) {
        defaultMode = 'token_plan_agentic';
      } else if (useWeb) {
        defaultMode = 'token_plan_web';
      } else if (useApiKey) {
        defaultMode = 'api_key';
      } else {
        defaultMode = null;
      }
    } else {
      if (defaultMode === 'api_key' && !useApiKey) {
        throw new BadRequestException(
          'El modo por defecto "api_key" no puede seleccionarse si dicho canal no está habilitado.',
        );
      }
      if (defaultMode === 'token_plan_web' && !useWeb) {
        throw new BadRequestException(
          'El modo por defecto "token_plan_web" no puede seleccionarse si dicho canal no está habilitado.',
        );
      }
      if (defaultMode === 'token_plan_agentic' && !useAgentic) {
        throw new BadRequestException(
          'El modo por defecto "token_plan_agentic" no puede seleccionarse si dicho canal no está habilitado.',
        );
      }
    }

    const existingCount = await this.aiProviderRepository.count();
    const isDefault = providerData.is_default ?? existingCount === 0;
    if (isDefault) {
      await this.aiProviderRepository
        .createQueryBuilder()
        .update(AiProvider)
        .set({ is_default: false })
        .where('is_default = :isDefault', { isDefault: true })
        .execute();
    }

    const { key: _k, mode: _m, ...restData } = providerData;
    const provider = this.aiProviderRepository.create({
      ...restData,
      catalog_id: catalog?.id ?? providerData.catalog_id,
      name: effectiveName,
      fields,
      use_api_key: useApiKey,
      use_token_plan_web: useWeb,
      use_token_plan_agentic: useAgentic,
      default_mode: defaultMode,
      is_default: isDefault,
    });
    const saved = await this.aiProviderRepository.save(provider);

    if (translates && translates.length > 0) {
      await this.translationService.saveTranslations(
        'ai_providers',
        saved.id,
        translates,
      );
    }

    return this.findProviderById(saved.id);
  }

  async updateProvider(
    id: string,
    updateDto: UpdateAiProviderDto,
  ): Promise<AiProvider> {
    const existing = await this.findProviderById(id);
    const { translates, ...rest } = updateDto;

    const catalogId = rest.catalog_id ?? existing.catalog_id;
    let key = rest.key ?? existing.key;
    const name = rest.name ?? existing.name;

    let catalog: AiProviderCatalog | null = null;
    if (catalogId) {
      catalog = await this.aiProviderCatalogRepository.findOne({
        where: { id: catalogId },
      });
      if (catalog) {
        key = catalog.key;
      }
    }

    const effectiveUseApiKey =
      rest.use_api_key !== undefined ? rest.use_api_key : existing.use_api_key;
    const effectiveUseWeb =
      rest.use_token_plan_web !== undefined
        ? rest.use_token_plan_web
        : existing.use_token_plan_web;
    const effectiveUseAgentic =
      rest.use_token_plan_agentic !== undefined
        ? rest.use_token_plan_agentic
        : existing.use_token_plan_agentic;

    if (catalog) {
      if (effectiveUseApiKey && !catalog.can_use_api_key) {
        throw new BadRequestException(
          `El catálogo "${catalog.name || catalog.key}" no permite habilitar el canal de API Key.`,
        );
      }
      if (effectiveUseWeb && !catalog.can_use_token_plan_web) {
        throw new BadRequestException(
          `El catálogo "${catalog.name || catalog.key}" no permite habilitar el canal de Token Plan Web.`,
        );
      }
      if (effectiveUseAgentic && !catalog.can_use_token_plan_agentic) {
        throw new BadRequestException(
          `El catálogo "${catalog.name || catalog.key}" no permite habilitar el canal de Token Plan Agentic.`,
        );
      }
    }

    const effectiveDefaultMode =
      rest.default_mode !== undefined
        ? rest.default_mode
        : existing.default_mode;

    if (effectiveDefaultMode) {
      if (effectiveDefaultMode === 'api_key' && !effectiveUseApiKey) {
        throw new BadRequestException(
          'El modo por defecto "api_key" no puede seleccionarse si dicho canal no está habilitado.',
        );
      }
      if (effectiveDefaultMode === 'token_plan_web' && !effectiveUseWeb) {
        throw new BadRequestException(
          'El modo por defecto "token_plan_web" no puede seleccionarse si dicho canal no está habilitado.',
        );
      }
      if (
        effectiveDefaultMode === 'token_plan_agentic' &&
        !effectiveUseAgentic
      ) {
        throw new BadRequestException(
          'El modo por defecto "token_plan_agentic" no puede seleccionarse si dicho canal no está habilitado.',
        );
      }
    }

    if (rest.fields) {
      const updatedFields = { ...existing.fields, ...rest.fields };
      const dummy = { key: key || existing.key, fields: updatedFields };
      rest.fields = sanitizeProviderFields(dummy).fields;
    }

    if (rest.is_default === true) {
      await this.aiProviderRepository
        .createQueryBuilder()
        .update(AiProvider)
        .set({ is_default: false })
        .where('is_default = :isDefault AND id != :id', {
          isDefault: true,
          id,
        })
        .execute();
    }

    const { key: _ignoredKey, mode: _ignoredMode, ...cleanRest } = rest;
    await this.aiProviderRepository.update(id, {
      ...cleanRest,
      catalog_id: catalogId,
      name,
    });

    if (translates !== undefined) {
      await this.translationService.updateTranslations(
        'ai_providers',
        id,
        translates,
      );
    }

    return this.findProviderById(id);
  }

  // ===========================================================================
  // AI PROVIDER CATALOG
  // ===========================================================================

  async findAllCatalogs(): Promise<AiProviderCatalog[]> {
    return this.aiProviderCatalogRepository.find({
      order: { id: 'ASC' },
    });
  }

  async findCatalogById(id: string): Promise<AiProviderCatalog | null> {
    return this.aiProviderCatalogRepository.findOne({ where: { id } });
  }

  async findCatalogByKey(key: string): Promise<AiProviderCatalog | null> {
    return this.aiProviderCatalogRepository.findOne({ where: { key } });
  }

  async createCatalog(
    createDto: CreateAiProviderCatalogDto,
  ): Promise<AiProviderCatalog> {
    const normalizedKey = createDto.key.trim().toLowerCase();
    const existing = await this.findCatalogByKey(normalizedKey);
    if (existing) {
      throw new ConflictException(
        `El proveedor de catálogo con clave "${normalizedKey}" ya existe.`,
      );
    }

    const catalog = this.aiProviderCatalogRepository.create({
      ...createDto,
      key: normalizedKey,
    });
    return this.aiProviderCatalogRepository.save(catalog);
  }

  async updateCatalog(
    id: string,
    updateDto: UpdateAiProviderCatalogDto,
  ): Promise<AiProviderCatalog> {
    const catalog = await this.findCatalogById(id);
    if (!catalog) {
      throw new NotFoundException(
        `El elemento de catálogo con ID "${id}" no existe.`,
      );
    }

    await this.aiProviderCatalogRepository.update(id, updateDto);
    return (await this.findCatalogById(id))!;
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

  async createApiKey(createDto: CreateAiApiKeyDto): Promise<AiApiKey> {
    await this.findProviderById(createDto.provider_id);

    if (createDto.is_selected) {
      await this.aiApiKeyRepository.update(
        { provider_id: createDto.provider_id, is_selected: true },
        { is_selected: false },
      );
    }

    const { secret, ...rest } = createDto;
    const secret_ciphertext = encryptSecret(secret);
    const secret_fingerprint = generateFingerprint(secret);
    const display_hint = generateDisplayHint(secret);

    const apiKey = this.aiApiKeyRepository.create({
      ...rest,
      secret_ciphertext,
      secret_fingerprint,
      display_hint,
    });

    return this.aiApiKeyRepository.save(apiKey);
  }

  async updateApiKey(
    id: string,
    updateDto: UpdateAiApiKeyDto,
  ): Promise<AiApiKey> {
    const apiKey = await this.findApiKeyById(id);

    if (updateDto.is_selected) {
      await this.aiApiKeyRepository.update(
        { provider_id: apiKey.provider_id, is_selected: true },
        { is_selected: false },
      );
    }

    const { secret, ...rest } = updateDto;
    Object.assign(apiKey, rest);

    if (secret) {
      apiKey.secret_ciphertext = encryptSecret(secret);
      apiKey.secret_fingerprint = generateFingerprint(secret);
      apiKey.display_hint = generateDisplayHint(secret);
    }

    return this.aiApiKeyRepository.save(apiKey);
  }

  async deleteApiKey(id: string): Promise<void> {
    const apiKey = await this.findApiKeyById(id);
    await this.aiApiKeyRepository.remove(apiKey);
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

  async getActiveApiKeySecret(providerId: string): Promise<string | null> {
    const keyEntity = await this.aiApiKeyRepository
      .createQueryBuilder('key')
      .addSelect('key.secret_ciphertext')
      .where('key.provider_id = :providerId', { providerId })
      .andWhere('key.is_active = true')
      .orderBy('key.is_selected', 'DESC')
      .addOrderBy('key.sort_order', 'ASC')
      .getOne();

    if (!keyEntity || !keyEntity.secret_ciphertext) {
      return null;
    }

    try {
      return decryptSecret(keyEntity.secret_ciphertext);
    } catch {
      return null;
    }
  }

  async updateProviderFields(
    id: string,
    fields: Record<string, any>,
  ): Promise<void> {
    await this.aiProviderRepository.update(id, { fields });
  }
}
