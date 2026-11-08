import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { ProductImage } from './entities/product-image.entity.js';

@Injectable()
export class ProductImageService {
  constructor(readonly dataSource: DataSource) {}
  transaction<T>(work: (manager: EntityManager) => Promise<T>) {
    return this.dataSource.transaction(work);
  }
  find(manager: EntityManager, businessId: string, id: string, lock = false) {
    return manager
      .getRepository(ProductImage)
      .findOne({
        where: { id, business_id: businessId },
        ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
      });
  }
}
