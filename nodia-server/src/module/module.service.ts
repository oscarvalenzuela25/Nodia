import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Module } from './entities/module.entity.js';
import { CreateModuleDto } from './dto/create-module.dto.js';
import { UpdateModuleDto } from './dto/update-module.dto.js';
import { GetModulesDto } from './dto/get-modules.dto.js';
import { applyRansack } from '../common/utils/ransack-query.builder.js';
import { GetModulesResponse } from './types/module.types.js';
import { TranslationService } from '../translation/translation.service.js';
import { RedisService } from '../common/redis/redis.service.js';

@Injectable()
export class ModuleService {
  constructor(
    @InjectRepository(Module)
    private readonly moduleRepository: Repository<Module>,
    private readonly translationService: TranslationService,
    private readonly redisService: RedisService,
  ) {}

  async findAll({
    page = 1,
    limit = 10,
    all = false,
    includes = true,
    q,
  }: GetModulesDto): Promise<GetModulesResponse> {
    const qb = this.moduleRepository.createQueryBuilder('module');

    if (includes) {
      qb.leftJoinAndSelect('module.module_group', 'module_group');
    }

    applyRansack(qb, q, 'module');

    const attachGroupTranslations = async (modulesList: any[]) => {
      if (!includes) return;
      const groupsMap = new Map<string, any>();
      for (const m of modulesList) {
        if (m.module_group?.id) {
          groupsMap.set(String(m.module_group.id), m.module_group);
        }
      }
      if (groupsMap.size > 0) {
        const translatedGroups = await this.translationService.attachTranslations(
          'module_groups',
          Array.from(groupsMap.values()),
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

  async findOne(id: string): Promise<Module> {
    const module = await this.moduleRepository.findOne({
      where: { id },
      relations: {
        module_group: true,
      },
    });

    if (!module) {
      throw new NotFoundException(`Module with ID "${id}" not found`);
    }

    if (module.module_group) {
      module.module_group = (await this.translationService.attachTranslationsToOne(
        'module_groups',
        module.module_group,
      )) as any;
    }

    return this.translationService.attachTranslationsToOne(
      'modules',
      module,
    ) as any;
  }

  async create(createModuleDto: CreateModuleDto): Promise<Module> {
    const existing = await this.moduleRepository.findOne({
      where: { key: createModuleDto.key },
    });
    if (existing) {
      return this.update(existing.id, createModuleDto);
    }

    const { translates, ...moduleData } = createModuleDto;
    const module = this.moduleRepository.create(moduleData);
    const savedModule = await this.moduleRepository.save(module);

    if (translates && translates.length > 0) {
      await this.translationService.saveTranslations(
        'modules',
        savedModule.id,
        translates,
      );
    }

    await this.redisService.delByPattern('auth:context:*');

    return this.findOne(savedModule.id);
  }

  async update(id: string, updateModuleDto: UpdateModuleDto): Promise<Module> {
    const module = await this.moduleRepository.findOne({ where: { id } });
    if (!module) {
      throw new NotFoundException(`Module with ID "${id}" not found`);
    }

    const { translates, ...rest } = updateModuleDto;
    Object.assign(module, rest);
    await this.moduleRepository.save(module);

    if (translates !== undefined) {
      await this.translationService.updateTranslations('modules', id, translates);
    }

    await this.redisService.delByPattern('auth:context:*');

    return this.findOne(id);
  }

  remove(id: number) {
    return `This action removes a #${id} module`;
  }
}

