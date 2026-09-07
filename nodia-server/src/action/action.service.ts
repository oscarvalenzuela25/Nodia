import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Action } from './entities/action.entity.js';
import { CreateActionDto } from './dto/create-action.dto.js';
import { UpdateActionDto } from './dto/update-action.dto.js';
import { GetActionsDto } from './dto/get-actions.dto.js';
import { applyRansack } from '../common/utils/ransack-query.builder.js';
import { GetActionsResponse } from './types/action.types.js';

@Injectable()
export class ActionService {
  constructor(
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
  ) {}

  async findAll({
    page = 1,
    limit = 10,
    all = false,
    includes = true,
    q,
  }: GetActionsDto): Promise<GetActionsResponse> {
    const qb = this.actionRepository.createQueryBuilder('action');

    if (includes) {
      qb.leftJoinAndSelect('action.module', 'module');
    }

    applyRansack(qb, q, 'action');

    const formatAction = (act: Action): Action => {
      const { action_roles: _ar, ...rest } = act;
      return {
        ...rest,
        module: includes ? (act.module ?? null) : null,
      } as Action;
    };

    if (all) {
      const rawData = await qb.getMany();
      const data = rawData.map(formatAction);
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

    const data = rawData.map(formatAction);
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

  async findOne(id: string): Promise<Action> {
    const action = await this.actionRepository.findOne({
      where: { id },
      relations: {
        module: true,
      },
    });
    if (!action) {
      throw new NotFoundException(`Action with ID "${id}" not found`);
    }
    const { action_roles: _ar, ...rest } = action;
    return {
      ...rest,
      module: action.module ?? null,
    } as Action;
  }

  async create(createActionDto: CreateActionDto): Promise<Action> {
    const action = this.actionRepository.create(createActionDto);
    const savedAction = await this.actionRepository.save(action);
    return this.findOne(savedAction.id);
  }

  async update(id: string, updateActionDto: UpdateActionDto): Promise<Action> {
    const action = await this.actionRepository.findOne({ where: { id } });
    if (!action) {
      throw new NotFoundException(`Action with ID "${id}" not found`);
    }

    Object.assign(action, updateActionDto);
    await this.actionRepository.save(action);

    return this.findOne(id);
  }

  remove(id: number) {
    return `This action removes a #${id} action`;
  }
}
