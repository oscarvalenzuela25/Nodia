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
  validateCivilPeriod,
} from '../../rental-common/rental-query.js';
import { RentalPaymentService } from '../rental-payment.service.js';
import { RentalPaymentQueryDto } from '../dto/rental-payment.dto.js';
import { projectRentalPayment } from '../types/rental-payment.types.js';

@Injectable()
export class GetRentalPaymentsUseCase {
  constructor(
    private readonly tx: RentalTransactionService,
    private readonly payments: RentalPaymentService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    input: RentalPaymentQueryDto,
  ) {
    const query = await validateRentalDto(RentalPaymentQueryDto, input);
    validateRentalQuery(query, 'payments');
    validateCivilPeriod(query.from_on, query.to_on);
    return this.tx.read(actorId, propertyId, async ({ manager }) => {
      const [rows, total] = await this.payments.list(
        manager,
        propertyId,
        query,
      );
      return pageResult(rows.map(projectRentalPayment), total, query);
    });
  }
}

@Injectable()
export class GetRentalPaymentUseCase {
  constructor(
    private readonly tx: RentalTransactionService,
    private readonly payments: RentalPaymentService,
  ) {}
  async execute(actorId: string, propertyId: string, id: string) {
    if (!isRentalId(id)) throw new BadRequestException('rental:invalid_input');
    return this.tx.read(actorId, propertyId, async ({ manager }) => {
      const row = await this.payments.find(manager, propertyId, id);
      if (!row) throw new NotFoundException('rental:not_found');
      return projectRentalPayment(row);
    });
  }
}
