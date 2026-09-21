import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessAction } from './entities/business-action.entity.js';
import { CreateBusinessActionDto } from './dto/create-business-action.dto.js';
import { UpdateBusinessActionDto } from './dto/update-business-action.dto.js';
import { GetBusinessActionsDto } from './dto/get-business-actions.dto.js';
import { applyRansack } from '../common/utils/ransack-query.builder.js';
import { GetBusinessActionsResponse } from './types/business-action.types.js';
import { TranslationService } from '../translation/translation.service.js';
import { RedisService } from '../common/redis/redis.service.js';

@Injectable()
export class BusinessActionService {
  constructor(
    @InjectRepository(BusinessAction)
    private readonly businessActionRepository: Repository<BusinessAction>,
    private readonly translationService: TranslationService,
    private readonly redisService: RedisService,
  ) {}

  async findAll({
    page = 1,
    limit = 10,
    all = false,
    q,
  }: GetBusinessActionsDto): Promise<GetBusinessActionsResponse> {
    const qb = this.businessActionRepository.createQueryBuilder('business_action');

    applyRansack(qb, q, 'business_action');

    if (all) {
      const rawData = await qb.getMany();
      const data = await this.translationService.attachTranslations(
        'business_actions',
        rawData,
      );
      return {
        data: data as any,
        meta: {
          page: 1,
          limit: data.length,
          total_items: data.length,
          total_pages: 1,
        },
      };
    }

    const [rawData, total_items] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data = await this.translationService.attachTranslations(
      'business_actions',
      rawData,
    );
    const total_pages = Math.ceil(total_items / limit);

    return {
      data: data as any,
      meta: {
        page,
        limit,
        total_items,
        total_pages,
      },
    };
  }

  async findOne(id: string): Promise<BusinessAction> {
    const businessAction = await this.businessActionRepository.findOne({
      where: { id },
    });
    if (!businessAction) {
      throw new NotFoundException(`BusinessAction with ID "${id}" not found`);
    }

    return this.translationService.attachTranslationsToOne(
      'business_actions',
      businessAction,
    ) as any;
  }

  async create(createBusinessActionDto: CreateBusinessActionDto): Promise<BusinessAction> {
    const existing = await this.businessActionRepository.findOne({
      where: { key: createBusinessActionDto.key },
    });
    if (existing) {
      return this.update(existing.id, createBusinessActionDto);
    }

    const { translates, ...actionData } = createBusinessActionDto;
    const businessAction = this.businessActionRepository.create(actionData);
    const savedAction = await this.businessActionRepository.save(businessAction);

    if (translates && translates.length > 0) {
      await this.translationService.saveTranslations(
        'business_actions',
        savedAction.id,
        translates,
      );
    }

    await this.redisService.delByPattern('auth:context:*');

    return this.findOne(savedAction.id);
  }

  async update(
    id: string,
    updateBusinessActionDto: UpdateBusinessActionDto,
  ): Promise<BusinessAction> {
    const businessAction = await this.businessActionRepository.findOne({ where: { id } });
    if (!businessAction) {
      throw new NotFoundException(`BusinessAction with ID "${id}" not found`);
    }

    const { translates, ...rest } = updateBusinessActionDto;
    Object.assign(businessAction, rest);
    await this.businessActionRepository.save(businessAction);

    if (translates !== undefined) {
      await this.translationService.updateTranslations('business_actions', id, translates);
    }

    await this.redisService.delByPattern('auth:context:*');

    return this.findOne(id);
  }

  async remove(id: string): Promise<{ message: string }> {
    const businessAction = await this.businessActionRepository.findOne({ where: { id } });
    if (!businessAction) {
      throw new NotFoundException(`BusinessAction with ID "${id}" not found`);
    }

    businessAction.is_active = false;
    await this.businessActionRepository.save(businessAction);
    await this.redisService.delByPattern('auth:context:*');

    return { message: `BusinessAction with ID "${id}" has been deactivated successfully` };
  }
}
