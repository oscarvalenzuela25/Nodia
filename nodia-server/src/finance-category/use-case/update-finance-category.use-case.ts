import { Injectable, NotFoundException } from '@nestjs/common';
import { FinanceCategoryService } from '../finance-category.service.js';
import { UpdateFinanceCategoryDto } from '../dto/update-finance-category.dto.js';
import { financeCategoryResponse } from '../types/finance-category.types.js';
import { throwFinanceCatalogError } from './finance-catalog-errors.js';

@Injectable()
export class UpdateFinanceCategoryUseCase {
  constructor(private readonly service: FinanceCategoryService) {}
  async execute(actorId: string, id: string, dto: UpdateFinanceCategoryDto) {
    try {
      return await this.service.transaction(async (manager) => {
        const category = await this.service.findOwned(
          actorId,
          id,
          manager,
          true,
        );
        if (!category)
          throw new NotFoundException('finance:category_not_found');
        if (dto.name !== undefined) category.name = dto.name;
        if (dto.key !== undefined) category.key = dto.key;
        if (dto.is_active !== undefined) category.is_active = dto.is_active;
        return financeCategoryResponse(
          await this.service.save(manager, category),
        );
      });
    } catch (error) {
      throwFinanceCatalogError(error);
    }
  }
}
