import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import { RedisService } from '../common/redis/redis.service.js';
import {
  applyRansack,
  validateRansackEnvelope,
} from '../common/utils/ransack-query.builder.js';
import { RANSACK_POLICIES } from '../common/utils/ransack-query.policies.js';
import { TranslationService } from '../translation/translation.service.js';
import { GetActionsDto } from './dto/get-actions.dto.js';
import { Action } from './entities/action.entity.js';
import { GetActionsResponse } from './types/action.types.js';

@Injectable()
export class ActionService {
  constructor(
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    private readonly translationService: TranslationService,
    _redisService: RedisService,
  ) {}

  async findAll(
    { page = 1, limit = 10, all = false, q }: GetActionsDto,
    manager?: EntityManager,
  ): Promise<GetActionsResponse> {
    const qb = (
      manager?.getRepository(Action) ?? this.actionRepository
    ).createQueryBuilder('action');
    validateRansackEnvelope(q);

    applyRansack(qb, q, 'action', RANSACK_POLICIES.action);
    if (manager && !/^id\s/i.test(String(q?.s ?? '')))
      qb.addOrderBy('action.id', 'ASC');

    if (all) {
      const rawData = await qb.getMany();
      const data = await this.translationService.attachTranslations(
        'actions',
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
      'actions',
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

  async findOne(id: string, manager?: EntityManager): Promise<Action> {
    const action = await (
      manager?.getRepository(Action) ?? this.actionRepository
    ).findOne({
      where: { id },
    });
    if (!action) {
      throw new NotFoundException(`Action with ID "${id}" not found`);
    }

    return this.translationService.attachTranslationsToOne(
      'actions',
      action,
      manager,
    ) as any;
  }
}
