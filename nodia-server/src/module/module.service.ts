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

@Injectable()
export class ModuleService {
  constructor(
    @InjectRepository(Module)
    private readonly moduleRepository: Repository<Module>,
    private readonly translationService: TranslationService,
  ) {}

  async findAll({
    page = 1,
    limit = 10,
    all = false,
    q,
  }: GetModulesDto): Promise<GetModulesResponse> {
    const qb = this.moduleRepository.createQueryBuilder('module');

    applyRansack(qb, q, 'module');

    if (all) {
      const rawData = await qb.getMany();
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
    });

    if (!module) {
      throw new NotFoundException(`Module with ID "${id}" not found`);
    }

    return this.translationService.attachTranslationsToOne(
      'modules',
      module,
    ) as any;
  }

  async create(createModuleDto: CreateModuleDto): Promise<Module> {
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

    return this.findOne(id);
  }

  remove(id: number) {
    return `This action removes a #${id} module`;
  }
}

