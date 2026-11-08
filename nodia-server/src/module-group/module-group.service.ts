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
import { GetModuleGroupsDto } from './dto/get-module-groups.dto.js';
import { ModuleGroup } from './entities/module-group.entity.js';
import { GetModuleGroupsResponse } from './types/module-group.types.js';
import { assertOrderView, attachGroupOrderMetadata } from '../module-order/order-metadata.js';

@Injectable()
export class ModuleGroupService {
  constructor(
    @InjectRepository(ModuleGroup)
    private readonly moduleGroupRepository: Repository<ModuleGroup>,
    private readonly translationService: TranslationService,
    _redisService: RedisService,
  ) {}

  async findAll(
    { page = 1, limit = 10, all = false, ordering = false, q }: GetModuleGroupsDto,
    manager?: EntityManager,
  ): Promise<GetModuleGroupsResponse> {
    assertOrderView({ ordering, all, limit, q });
    if (ordering && !manager) {
      return this.moduleGroupRepository.manager.transaction('REPEATABLE READ', (snapshot) =>
        this.findAll({ page, limit, all, ordering, q }, snapshot),
      );
    }
    const qb = (
      manager?.getRepository(ModuleGroup) ?? this.moduleGroupRepository
    ).createQueryBuilder('module_group');
    validateRansackEnvelope(q);

    applyRansack(qb, q, 'module_group', RANSACK_POLICIES.module_group);
    if (!q?.s) qb.addOrderBy('module_group.sort_order', 'ASC');
    if (!/^id(?:\s|$)/i.test(String(q?.s ?? '').trim())) qb.addOrderBy('module_group.id', 'ASC');

    if (all) {
      const rawData = await qb.getMany();
      const data = await this.translationService.attachTranslations(
        'module_groups',
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
      'module_groups',
      rawData,
      manager,
    );
    const total_pages = Math.ceil(total_items / limit);

    return {
      data: ordering
        ? await attachGroupOrderMetadata(manager!, data)
        : data,
      meta: {
        page,
        limit,
        total_items,
        total_pages,
      },
    };
  }

  async findOne(id: string, manager?: EntityManager): Promise<ModuleGroup> {
    const moduleGroup = await (
      manager?.getRepository(ModuleGroup) ?? this.moduleGroupRepository
    ).findOne({
      where: { id },
    });

    if (!moduleGroup) {
      throw new NotFoundException(`ModuleGroup with ID "${id}" not found`);
    }

    return this.translationService.attachTranslationsToOne(
      'module_groups',
      moduleGroup,
      manager,
    ) as any;
  }
}
