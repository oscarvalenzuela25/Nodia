import { Injectable } from '@nestjs/common';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import type { ProductAvailabilityQueryDto } from '../dto/product-barcode-query.dto.js';
import { ProductService } from '../product.service.js';

@Injectable()
export class GetProductAvailabilityUseCase {
  constructor(private readonly products: ProductService) {}
  execute(query: ProductAvailabilityQueryDto, actor: ActorReference) {
    return this.products.availabilitySummary(
      query.business_id,
      query.activity ?? 'active',
      actor,
    );
  }
}
