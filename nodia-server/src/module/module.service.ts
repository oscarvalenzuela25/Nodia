import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import { RedisService } from '../common/redis/redis.service.js';
import {
  applyRansack,
  validateRansackEnvelope,
} from '../common/utils/ransack-query.builder.js';
import { RANSACK_POLICIES } from '../common/utils/ransack-query.policies.js';
import { TranslationService } from '../translation/translation.service.js';
import { GetModulesDto } from './dto/get-modules.dto.js';
import { Module } from './entities/module.entity.js';
import { GetModulesResponse } from './types/module.types.js';
import { assertOrderView, attachModuleOrderMetadata, locateModuleOrderPage } from '../module-order/order-metadata.js';

@Injectable()
export class ModuleService {
  constructor(
    @InjectRepository(Module)
    private readonly moduleRepository: Repository<Module>,
    private readonly translationService: TranslationService,
    _redisService: RedisService,
  ) {}

  async findAll(
    { page = 1, limit = 10, all = false, includes = true, ordering = false, locate_id, q }: GetModulesDto,
    manager?: EntityManager,
  ): Promise<GetModulesResponse> {
    assertOrderView({ ordering, all, limit, q });
    if (locate_id !== undefined && !ordering)
      throw new BadRequestException('modules:invalid_order_view');
    if (ordering && !manager) {
      return this.moduleRepository.manager.transaction('REPEATABLE READ', (snapshot) =>
        this.findAll({ page, limit, all, includes, ordering, locate_id, q }, snapshot),
      );
    }
    if (locate_id !== undefined)
      page = await locateModuleOrderPage(manager!, locate_id, limit);
    const qb = (
      manager?.getRepository(Module) ?? this.moduleRepository
    ).createQueryBuilder('module');
    validateRansackEnvelope(q);

    if (includes) {
      qb.leftJoinAndSelect('module.module_group', 'module_group');
    } else {
      qb.leftJoin('module.module_group', 'module_group');
    }

    applyRansack(qb, q, 'module', RANSACK_POLICIES.module);
    if (!q?.s) {
      qb.addOrderBy('module_group.sort_order', 'ASC');
      qb.addOrderBy('module_group.id', 'ASC');
      qb.addOrderBy('module.sort_order', 'ASC');
    }
    if (!/^id(?:\s|$)/i.test(String(q?.s ?? '').trim())) qb.addOrderBy('module.id', 'ASC');

    const attachGroupTranslations = async (modulesList: Module[]) => {
      if (!includes) return;
      const groupsMap = new Map<string, NonNullable<Module['module_group']>>();
      for (const m of modulesList) {
        if (m.module_group?.id) {
          groupsMap.set(String(m.module_group.id), m.module_group);
        }
      }
      if (groupsMap.size > 0) {
        const translatedGroups =
          await this.translationService.attachTranslations(
            'module_groups',
            Array.from(groupsMap.values()),
            manager,
          );
        const translatedMap = new Map(
          translatedGroups.map((g) => [String(g.id), g]),
        );
        for (const m of modulesList) {
          if (m.module_group?.id) {
            m.module_group =
              translatedMap.get(String(m.module_group.id)) ?? m.module_group;
          }
        }
      }
    };

    if (all) {
      const rawData = await qb.getMany();
      await attachGroupTranslations(rawData);
      const data = await this.translationService.attachTranslations(
        'modules',
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

    // The only join is many-to-one; direct pagination keeps includes=false unhydrated.
    const [rawData, total_items] = await qb
      .offset((page - 1) * limit)
      .limit(limit)
      .getManyAndCount();

    await attachGroupTranslations(rawData);
    const data = await this.translationService.attachTranslations(
      'modules',
      rawData,
      manager,
    );
    const total_pages = Math.ceil(total_items / limit);

    return {
      data: ordering
        ? await attachModuleOrderMetadata(manager!, data)
        : data,
      meta: {
        page,
        limit,
        total_items,
        total_pages,
      },
    };
  }

  async findOne(id: string, manager?: EntityManager): Promise<Module> {
    const module = await (
      manager?.getRepository(Module) ?? this.moduleRepository
    ).findOne({
      where: { id },
      relations: {
        module_group: true,
      },
    });

    if (!module) {
      throw new NotFoundException(`Module with ID "${id}" not found`);
    }

    if (module.module_group) {
      module.module_group =
        (await this.translationService.attachTranslationsToOne(
          'module_groups',
          module.module_group,
          manager,
        )) as any;
    }

    return this.translationService.attachTranslationsToOne(
      'modules',
      module,
      manager,
    ) as any;
  }
}
