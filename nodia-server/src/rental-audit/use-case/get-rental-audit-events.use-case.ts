import { Injectable } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { validateRentalDto } from '../../rental-common/rental-validation.js';
import {
  pageResult,
  validateInstantPeriod,
  validateRentalQuery,
} from '../../rental-common/rental-query.js';
import { RentalAuditQueryDto } from '../dto/rental-audit-query.dto.js';
import { RentalAuditService } from '../rental-audit.service.js';
@Injectable()
export class GetRentalAuditEventsUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly audit: RentalAuditService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    input: RentalAuditQueryDto,
  ) {
    const query = await validateRentalDto(RentalAuditQueryDto, input);
    validateRentalQuery(query, 'audit');
    validateInstantPeriod(query.from_at, query.to_at);
    return this.transactions.read(actorId, propertyId, async ({ manager }) => {
      const [rows, total] = await this.audit.page(manager, propertyId, query);
      return pageResult(
        rows.map((row) => ({
          id: row.id,
          property_id: row.property_id,
          actor_id: row.actor_id,
          action: row.action,
          resource_type: row.resource_type,
          resource_id: row.resource_id,
          changes: row.changes,
          created_at: row.created_at.toISOString(),
        })),
        total,
        query,
      );
    });
  }
}
