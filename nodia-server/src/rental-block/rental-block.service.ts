import { Injectable } from '@nestjs/common';
import type { EntityManager, DeepPartial } from 'typeorm';
import { RentalBlock } from './entities/rental-block.entity.js';
import { RentalBlockQueryDto } from './dto/rental-block.dto.js';
import { applyRentalQuery } from '../rental-common/rental-query.js';

@Injectable()
export class RentalBlockService {
  find(manager: EntityManager, propertyId: string, id: string) {
    return manager
      .getRepository(RentalBlock)
      .findOne({ where: { property_id: propertyId, id } });
  }
  save(manager: EntityManager, row: DeepPartial<RentalBlock>) {
    return manager.getRepository(RentalBlock).save(row);
  }
  list(manager: EntityManager, propertyId: string, query: RentalBlockQueryDto) {
    const qb = manager
      .getRepository(RentalBlock)
      .createQueryBuilder('block')
      .where('block.property_id = :propertyId', { propertyId });
    if (query.starts_at)
      qb.andWhere('block.starts_at < :to AND block.ends_at > :from', {
        from: new Date(query.starts_at),
        to: new Date(query.ends_at!),
      });
    applyRentalQuery(qb, 'block', query, 'blocks');
    return qb
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
  }
}
