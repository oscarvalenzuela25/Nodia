import { Injectable, NotFoundException } from '@nestjs/common';
import { FinanceCategoryService } from '../finance-category.service.js';
import { financeCategoryResponse } from '../types/finance-category.types.js';

@Injectable()
export class GetFinanceCategoryUseCase {
  constructor(private readonly service: FinanceCategoryService) {}
  async execute(actorId: string, id: string) {
    const category = await this.service.findOwned(actorId, id);
    if (!category) throw new NotFoundException('finance:category_not_found');
    return financeCategoryResponse(category);
  }
}
