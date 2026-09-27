import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiProvider } from './entities/ai-provider.entity.js';
import { AiApiKey } from './entities/ai-api-key.entity.js';
import { AiProviderEvent } from './entities/ai-provider-event.entity.js';
import { CreateAiProviderDto } from './dto/create-ai-provider.dto.js';
import { UpdateAiProviderDto } from './dto/update-ai-provider.dto.js';
import { GetAiProvidersDto } from './dto/get-ai-providers.dto.js';
import { CreateAiApiKeyDto } from './dto/create-ai-api-key.dto.js';
import { UpdateAiApiKeyDto } from './dto/update-ai-api-key.dto.js';
import { GetAiApiKeysDto } from './dto/get-ai-api-keys.dto.js';
import { CreateAiProviderEventDto } from './dto/create-ai-provider-event.dto.js';
import { GetAiProviderEventsDto } from './dto/get-ai-provider-events.dto.js';
import {
  GetAiProvidersResponse,
  GetAiApiKeysResponse,
  GetAiProviderEventsResponse,
} from './types/ai-provider.types.js';
import { applyRansack } from '../common/utils/ransack-query.builder.js';
import { TranslationService } from '../translation/translation.service.js';
import {
  encryptSecret,
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

    if (includes) {
      qb.leftJoinAndSelect('ai_provider.api_keys', 'api_keys');
    }

    applyRansack(qb, q, 'ai_provider');

    if (all) {
      const rawData = await qb.getMany();
      const data = await this.translationService.attachTranslations(
        'ai_providers',
        rawData,
      );
      const sanitizedData = data.map((item) => sanitizeProviderFields(item));
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
    const sanitizedData = data.map((item) => sanitizeProviderFields(item));
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

    const supported = getSupportedProviderByKey(providerData.key);
    const fields = providerData.fields ? { ...providerData.fields } : {};

    let mode = providerData.mode;
    if (!mode && supported) {
      mode = supported.defaultMode;
    }

    if (supported) {
      if (!fields.available_models) {
        fields.available_models = supported.availableModels;
      }
      if (!fields.selected_model) {
        fields.selected_model = supported.defaultSelectedModel;
      }
      if (supported.defaultOcrModel && !fields.ocr_model) {
        fields.ocr_model = supported.defaultOcrModel;
      }
    }

    const provider = this.aiProviderRepository.create({
      ...providerData,
      mode: mode || (supported?.defaultMode ?? undefined),
      fields,
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

    if (rest.fields) {
      const supported = getSupportedProviderByKey(existing.key);
      const updatedFields = { ...existing.fields, ...rest.fields };

      if (supported) {
        if (!updatedFields.available_models) {
          updatedFields.available_models =
            existing.fields?.available_models || supported.availableModels;
        }
        if (!updatedFields.selected_model) {
          updatedFields.selected_model =
            existing.fields?.selected_model || supported.defaultSelectedModel;
        }
      }
      const dummy = { key: existing.key, fields: updatedFields };
      sanitizeProviderFields(dummy);
      rest.fields = dummy.fields;
    }

    await this.aiProviderRepository.update(id, rest);

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

    if (includes) {
      qb.leftJoinAndSelect('api_key.provider', 'provider');
    }

    applyRansack(qb, q, 'api_key');

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

    if (includes) {
      qb.leftJoinAndSelect('event.provider', 'provider')
        .leftJoinAndSelect('event.api_key', 'api_key')
        .leftJoinAndSelect('event.actor_user', 'actor_user');
    }

    applyRansack(qb, q, 'event');

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
}
