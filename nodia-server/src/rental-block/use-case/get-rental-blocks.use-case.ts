import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import {
  validateRentalDto,
  isRentalId,
} from '../../rental-common/rental-validation.js';
import {
  pageResult,
  validateRentalQuery,
  validateInstantPeriod,
} from '../../rental-common/rental-query.js';
import { RentalBlockService } from '../rental-block.service.js';
import { RentalBlockQueryDto } from '../dto/rental-block.dto.js';
import { projectRentalBlock } from '../types/rental-block.types.js';

@Injectable()
export class GetRentalBlocksUseCase {
  constructor(
    private readonly tx: RentalTransactionService,
    private readonly blocks: RentalBlockService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    input: RentalBlockQueryDto,
  ) {
    const query = await validateRentalDto(RentalBlockQueryDto, input);
    validateRentalQuery(query, 'blocks');
    validateInstantPeriod(query.starts_at, query.ends_at);
    return this.tx.read(actorId, propertyId, async ({ manager }) => {
      const [rows, total] = await this.blocks.list(manager, propertyId, query);
      return pageResult(rows.map(projectRentalBlock), total, query);
    });
  }
}

@Injectable()
export class GetRentalBlockUseCase {
  constructor(
    private readonly tx: RentalTransactionService,
    private readonly blocks: RentalBlockService,
  ) {}
  async execute(actorId: string, propertyId: string, id: string) {
    if (!isRentalId(id)) throw new BadRequestException('rental:invalid_input');
    return this.tx.read(actorId, propertyId, async ({ manager }) => {
      const row = await this.blocks.find(manager, propertyId, id);
      if (!row) throw new NotFoundException('rental:not_found');
      return projectRentalBlock(row);
    });
  }
}
