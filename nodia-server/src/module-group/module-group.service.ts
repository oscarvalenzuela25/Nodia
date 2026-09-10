import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModuleGroup } from './entities/module-group.entity.js';
import { CreateModuleGroupDto } from './dto/create-module-group.dto.js';
import { UpdateModuleGroupDto } from './dto/update-module-group.dto.js';
import { GetModuleGroupsDto } from './dto/get-module-groups.dto.js';
import { applyRansack } from '../common/utils/ransack-query.builder.js';
import { GetModuleGroupsResponse } from './types/module-group.types.js';
import { TranslationService } from '../translation/translation.service.js';
import { RedisService } from '../common/redis/redis.service.js';

@Injectable()
export class ModuleGroupService {
  constructor(
    @InjectRepository(ModuleGroup)
    private readonly moduleGroupRepository: Repository<ModuleGroup>,
    private readonly translationService: TranslationService,
    private readonly redisService: RedisService,
  ) {}

  async findAll({
    page = 1,
    limit = 10,
    all = false,
    q,
  }: GetModuleGroupsDto): Promise<GetModuleGroupsResponse> {
    const qb = this.moduleGroupRepository.createQueryBuilder('module_group');

    applyRansack(qb, q, 'module_group');

    if (all) {
      const rawData = await qb.getMany();
      const data = await this.translationService.attachTranslations(
        'module_groups',
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
      'module_groups',
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

  async findOne(id: string): Promise<ModuleGroup> {
    const moduleGroup = await this.moduleGroupRepository.findOne({
      where: { id },
    });

    if (!moduleGroup) {
      throw new NotFoundException(`ModuleGroup with ID "${id}" not found`);
    }

    return this.translationService.attachTranslationsToOne(
      'module_groups',
      moduleGroup,
    ) as any;
  }

  async create(createDto: CreateModuleGroupDto): Promise<ModuleGroup> {
    const existing = await this.moduleGroupRepository.findOne({
      where: { key: createDto.key },
    });
    if (existing) {
      return this.update(existing.id, createDto);
    }

    const { translates, ...groupData } = createDto;
    const moduleGroup = this.moduleGroupRepository.create(groupData);
    const savedGroup = await this.moduleGroupRepository.save(moduleGroup);

    if (translates && translates.length > 0) {
      await this.translationService.saveTranslations(
        'module_groups',
        savedGroup.id,
        translates,
      );
    }

    await this.redisService.delByPattern('auth:context:*');

    return this.findOne(savedGroup.id);
  }

  async update(id: string, updateDto: UpdateModuleGroupDto): Promise<ModuleGroup> {
    const moduleGroup = await this.moduleGroupRepository.findOne({ where: { id } });
    if (!moduleGroup) {
      throw new NotFoundException(`ModuleGroup with ID "${id}" not found`);
    }

    const { translates, ...rest } = updateDto;
    Object.assign(moduleGroup, rest);
    await this.moduleGroupRepository.save(moduleGroup);

    if (translates !== undefined) {
      await this.translationService.updateTranslations(
        'module_groups',
        id,
        translates,
      );
    }

    await this.redisService.delByPattern('auth:context:*');

    return this.findOne(id);
  }
}
