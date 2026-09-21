import { Injectable } from '@nestjs/common';
import { UpdateProductLogDto } from '../dto/update-product-log.dto.js';
import { ProductService } from '../product.service.js';

@Injectable()
export class UpdateProductLogUseCase {
  constructor(private readonly productService: ProductService) {}

  async execute(id: string, updateProductLogDto: UpdateProductLogDto) {
    return this.productService.updateLog(id, updateProductLogDto);
  }
}
