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
import { GetModulesDto } from './dto/get-modules.dto.js';
import { Module } from './entities/module.entity.js';
import { GetModulesResponse } from './types/module.types.js';

@Injectable()
export class ModuleService {
  constructor(
    @InjectRepository(Module)
    private readonly moduleRepository: Repository<Module>,
    private readonly translationService: TranslationService,
    _redisService: RedisService,
  ) {}

  async findAll(
    { page = 1, limit = 10, all = false, includes = true, q }: GetModulesDto,
    manager?: EntityManager,
  ): Promise<GetModulesResponse> {
    const qb = (
      manager?.getRepository(Module) ?? this.moduleRepository
    ).createQueryBuilder('module');
    validateRansackEnvelope(q);

    if (includes) {
      qb.leftJoinAndSelect('module.module_group', 'module_group');
    }

    applyRansack(qb, q, 'module', RANSACK_POLICIES.module);
    if (manager && !/^id\s/i.test(String(q?.s ?? '')))
      qb.addOrderBy('module.id', 'ASC');

    const attachGroupTranslations = async (modulesList: any[]) => {
      if (!includes) return;
      const groupsMap = new Map<string, any>();
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

    const [rawData, total_items] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    await attachGroupTranslations(rawData);
    const data = await this.translationService.attachTranslations(
      'modules',
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
