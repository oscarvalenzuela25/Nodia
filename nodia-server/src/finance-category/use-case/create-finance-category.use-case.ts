import { Injectable } from '@nestjs/common';
import { FinanceCategoryService } from '../finance-category.service.js';
import { CreateFinanceCategoryDto } from '../dto/create-finance-category.dto.js';
import { financeCategoryResponse } from '../types/finance-category.types.js';
import { throwFinanceCatalogError } from './finance-catalog-errors.js';

@Injectable()
export class CreateFinanceCategoryUseCase {
  constructor(private readonly service: FinanceCategoryService) {}
  async execute(actorId: string, dto: CreateFinanceCategoryDto) {
    try {
      return await this.service.transaction(async (manager) =>
        financeCategoryResponse(
          await this.service.insert(manager, {
            user_id: actorId,
            name: dto.name,
            key: dto.key,
            is_active: dto.is_active ?? true,
          }),
        ),
      );
    } catch (error) {
      throwFinanceCatalogError(error);
    }
  }
}
