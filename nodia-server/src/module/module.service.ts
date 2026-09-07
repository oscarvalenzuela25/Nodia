import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Module } from './entities/module.entity.js';
import { CreateModuleDto } from './dto/create-module.dto.js';
import { UpdateModuleDto } from './dto/update-module.dto.js';
import { GetModulesDto } from './dto/get-modules.dto.js';
import { applyRansack } from '../common/utils/ransack-query.builder.js';
import { GetModulesResponse } from './types/module.types.js';

@Injectable()
export class ModuleService {
  constructor(
    @InjectRepository(Module)
    private readonly moduleRepository: Repository<Module>,
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
      qb.leftJoinAndSelect('module.parent', 'parent');
    }

    applyRansack(qb, q, 'module');

    const formatModule = (mod: Module): Module => {
      const { actions: _a, children: _c, parent, ...rest } = mod;
      return {
        ...rest,
        parent_module:
          includes && mod.type === 'submodule' && parent
            ? {
                id: parent.id,
                key: parent.key,
                type: parent.type,
                is_active: parent.is_active,
              }
            : null,
      } as Module;
    };

    if (all) {
      const rawData = await qb.getMany();
      const data = rawData.map(formatModule);
      return {
        data,
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

    const data = rawData.map(formatModule);
    const total_pages = Math.ceil(total_items / limit);

    return {
      data,
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
        parent: true,
      },
    });

    if (!module) {
      throw new NotFoundException(`Module with ID "${id}" not found`);
    }

    const { actions: _a, children: _c, parent, ...rest } = module;
    return {
      ...rest,
      parent_module:
        module.type === 'submodule' && parent
          ? {
              id: parent.id,
              key: parent.key,
              type: parent.type,
              is_active: parent.is_active,
            }
          : null,
    } as Module;
  }

  async create(createModuleDto: CreateModuleDto): Promise<Module> {
    if (createModuleDto.type === 'submodule') {
      if (!createModuleDto.parent_id) {
        throw new BadRequestException('parent_id is required when type is submodule');
      }

      const parent = await this.moduleRepository.findOne({
        where: { id: createModuleDto.parent_id },
      });
      if (!parent) {
        throw new NotFoundException(
          `Parent module with ID "${createModuleDto.parent_id}" not found`,
        );
      }
      if (parent.type !== 'module') {
        throw new BadRequestException(
          'A submodule cannot have another submodule as its parent',
        );
      }
    }

    if (createModuleDto.type === 'module') {
      createModuleDto.parent_id = null;
    }

    const module = this.moduleRepository.create(createModuleDto);
    const savedModule = await this.moduleRepository.save(module);

    return this.findOne(savedModule.id);
  }

  async update(id: string, updateModuleDto: UpdateModuleDto): Promise<Module> {
    const module = await this.moduleRepository.findOne({ where: { id } });
    if (!module) {
      throw new NotFoundException(`Module with ID "${id}" not found`);
    }

    const targetType = updateModuleDto.type ?? module.type;
    const targetParentId =
      updateModuleDto.parent_id !== undefined
        ? updateModuleDto.parent_id
        : module.parent_id;

    if (targetType === 'submodule') {
      if (!targetParentId) {
        throw new BadRequestException('parent_id is required when type is submodule');
      }
      if (targetParentId === id) {
        throw new BadRequestException('A submodule cannot be its own parent');
      }
      if (module.type === 'module') {
        const childrenCount = await this.moduleRepository.count({
          where: { parent_id: id },
        });
        if (childrenCount > 0) {
          throw new BadRequestException(
            'Cannot convert a module with submodules into a submodule',
          );
        }
      }

      const parent = await this.moduleRepository.findOne({
        where: { id: targetParentId },
      });
      if (!parent) {
        throw new NotFoundException(
          `Parent module with ID "${targetParentId}" not found`,
        );
      }
      if (parent.type !== 'module') {
        throw new BadRequestException(
          'A submodule cannot have another submodule as its parent',
        );
      }
    }

    if (targetType === 'module') {
      updateModuleDto.parent_id = null;
    }

    Object.assign(module, updateModuleDto);
    await this.moduleRepository.save(module);

    if (updateModuleDto.is_active === false && module.type === 'module') {
      await this.moduleRepository.update(
        { parent_id: module.id },
        { is_active: false },
      );
    }

    return this.findOne(id);
  }

  remove(id: number) {
    return `This action removes a #${id} module`;
  }
}
