import type { FinanceActor } from '../../authorization/authority-transaction.js';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FinanceCategoryService } from '../finance-category.service.js';
import { throwFinanceCatalogError } from './finance-catalog-errors.js';

@Injectable()
export class DeleteFinanceCategoryUseCase {
  constructor(private readonly service: FinanceCategoryService) {}
  async execute(actor: FinanceActor, id: string): Promise<void> {
    return this.service.withScope(
      actor,
      async ({ manager: scopedManager, ownerId: userId }) => {
        try {
          await this.service.transaction(async (manager) => {
            if (!(await this.service.findOwned(userId, id, manager, true)))
              throw new NotFoundException('finance:category_not_found');
            if (await this.service.hasMovements(manager, userId, id))
              throw new ConflictException('finance:category_has_movements');
            await this.service.deleteMemberships(manager, userId, id);
            await this.service.deleteOwned(manager, userId, id);
          }, scopedManager);
        } catch (error) {
          throwFinanceCatalogError(error);
        }
      },
    );
  }
}
