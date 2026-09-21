import { Injectable } from '@nestjs/common';
import { CreateProductLogDto } from '../dto/create-product-log.dto.js';
import { ProductService } from '../product.service.js';

@Injectable()
export class CreateProductLogUseCase {
  constructor(private readonly productService: ProductService) {}

  async execute(createProductLogDto: CreateProductLogDto) {
    return this.productService.createLog(createProductLogDto);
  }
}
