import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { RentalAuditEvent } from './entities/rental-audit-event.entity.js';
import type { RentalAuditQueryDto } from './dto/rental-audit-query.dto.js';
@Injectable()
export class RentalAuditService {
  page(
    manager: EntityManager,
    propertyId: string,
    query: RentalAuditQueryDto,
  ): Promise<[RentalAuditEvent[], number]> {
    const qb = manager
      .getRepository(RentalAuditEvent)
      .createQueryBuilder('event')
      .where('event.property_id = :propertyId', { propertyId });
    for (const field of ['resource_type', 'resource_id', 'action'] as const)
      if (query[field] !== undefined)
        qb.andWhere(`event.${field} = :${field}`, { [field]: query[field] });
    if (query.from_at)
      qb.andWhere('event.created_at >= :from AND event.created_at < :to', {
        from: query.from_at,
        to: query.to_at,
      });
    return qb
      .orderBy('event.created_at', 'DESC')
      .addOrderBy('event.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
  }
}
