import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import { BusinessAction } from './entities/business-action.entity.js';
import { GetBusinessActionsDto } from './dto/get-business-actions.dto.js';
import {
  applyRansack,
  validateRansackEnvelope,
} from '../common/utils/ransack-query.builder.js';
import { RANSACK_POLICIES } from '../common/utils/ransack-query.policies.js';
import { GetBusinessActionsResponse } from './types/business-action.types.js';
import { TranslationService } from '../translation/translation.service.js';
import { RedisService } from '../common/redis/redis.service.js';

@Injectable()
export class BusinessActionService {
  constructor(
    @InjectRepository(BusinessAction)
    private readonly businessActionRepository: Repository<BusinessAction>,
    private readonly translationService: TranslationService,
    _redisService: RedisService,
  ) {}

  async findAll(
    { page = 1, limit = 10, all = false, q }: GetBusinessActionsDto,
    manager?: EntityManager,
  ): Promise<GetBusinessActionsResponse> {
    const qb = (
      manager?.getRepository(BusinessAction) ?? this.businessActionRepository
    ).createQueryBuilder('business_action');
    validateRansackEnvelope(q);

    applyRansack(qb, q, 'business_action', RANSACK_POLICIES.business_action);
    if (manager && !/^id\s/i.test(String(q?.s ?? '')))
      qb.addOrderBy('business_action.id', 'ASC');

    if (all) {
      const rawData = await qb.getMany();
      const data = await this.translationService.attachTranslations(
        'business_actions',
        rawData,
        manager,
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
      manager,
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

  async findOne(id: string, manager?: EntityManager): Promise<BusinessAction> {
    const businessAction = await (
      manager?.getRepository(BusinessAction) ?? this.businessActionRepository
    ).findOne({
      where: { id },
    });
    if (!businessAction) {
      throw new NotFoundException(`BusinessAction with ID "${id}" not found`);
    }

    return this.translationService.attachTranslationsToOne(
      'business_actions',
      businessAction,
      manager,
    ) as any;
  }
}
