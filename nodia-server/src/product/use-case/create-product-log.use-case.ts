import type { EntityManager } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { CreateProductLogDto } from '../dto/create-product-log.dto.js';
import { ProductService } from '../product.service.js';

@Injectable()
export class CreateProductLogUseCase {
  constructor(private readonly productService: ProductService) {}

  async execute(createProductLogDto: CreateProductLogDto, manager?: EntityManager) {
    return manager ? this.productService.createLog(createProductLogDto, manager) : this.productService.createLog(createProductLogDto);
  }
}
