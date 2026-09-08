import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Action } from './entities/action.entity.js';
import { CreateActionDto } from './dto/create-action.dto.js';
import { UpdateActionDto } from './dto/update-action.dto.js';
import { GetActionsDto } from './dto/get-actions.dto.js';
import { applyRansack } from '../common/utils/ransack-query.builder.js';
import { GetActionsResponse } from './types/action.types.js';
import { TranslationService } from '../translation/translation.service.js';

@Injectable()
export class ActionService {
  constructor(
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    private readonly translationService: TranslationService,
  ) {}

  async findAll({
    page = 1,
    limit = 10,
    all = false,
    q,
  }: GetActionsDto): Promise<GetActionsResponse> {
    const qb = this.actionRepository.createQueryBuilder('action');

    applyRansack(qb, q, 'action');

    if (all) {
      const rawData = await qb.getMany();
      const data = await this.translationService.attachTranslations(
        'actions',
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
      'actions',
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

  async findOne(id: string): Promise<Action> {
    const action = await this.actionRepository.findOne({
      where: { id },
    });
    if (!action) {
      throw new NotFoundException(`Action with ID "${id}" not found`);
    }

    return this.translationService.attachTranslationsToOne(
      'actions',
      action,
    ) as any;
  }

  async create(createActionDto: CreateActionDto): Promise<Action> {
    const { translates, ...actionData } = createActionDto;
    const action = this.actionRepository.create(actionData);
    const savedAction = await this.actionRepository.save(action);

    if (translates && translates.length > 0) {
      await this.translationService.saveTranslations(
        'actions',
        savedAction.id,
        translates,
      );
    }

    return this.findOne(savedAction.id);
  }

  async update(id: string, updateActionDto: UpdateActionDto): Promise<Action> {
    const action = await this.actionRepository.findOne({ where: { id } });
    if (!action) {
      throw new NotFoundException(`Action with ID "${id}" not found`);
    }

    const { translates, ...rest } = updateActionDto;
    Object.assign(action, rest);
    await this.actionRepository.save(action);

    if (translates !== undefined) {
      await this.translationService.updateTranslations('actions', id, translates);
    }

    return this.findOne(id);
  }

  remove(id: number) {
    return `This action removes a #${id} action`;
  }
}

