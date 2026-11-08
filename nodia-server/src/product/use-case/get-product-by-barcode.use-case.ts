import { Injectable } from '@nestjs/common';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import type { ProductBarcodeQueryDto } from '../dto/product-barcode-query.dto.js';
import { ProductService } from '../product.service.js';

@Injectable()
export class GetProductByBarcodeUseCase {
  constructor(private readonly products: ProductService) {}
  execute(query: ProductBarcodeQueryDto, actor: ActorReference) {
    return this.products.findByBarcode(query.business_id, query.barcode, actor);
  }
}
