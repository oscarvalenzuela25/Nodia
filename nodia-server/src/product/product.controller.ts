import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto.js';
import { BulkCreateProductDto } from './dto/bulk-create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { BulkUpdateProductDto } from './dto/bulk-update-product.dto.js';
import { GetProductsDto } from './dto/get-products.dto.js';
import { GetAllProductsUseCase } from './use-case/get-all-products.use-case.js';
import { GetProductByIdUseCase } from './use-case/get-product-by-id.use-case.js';
import { CreateProductUseCase } from './use-case/create-product.use-case.js';
import { CreateBulkProductsUseCase } from './use-case/create-bulk-products.use-case.js';
import { UpdateProductUseCase } from './use-case/update-product.use-case.js';
import { UpdateBulkProductsUseCase } from './use-case/update-bulk-products.use-case.js';

@Controller(['product', 'products'])
export class ProductController {
  constructor(
    private readonly getAllProductsUseCase: GetAllProductsUseCase,
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    private readonly createProductUseCase: CreateProductUseCase,
    private readonly createBulkProductsUseCase: CreateBulkProductsUseCase,
    private readonly updateProductUseCase: UpdateProductUseCase,
    private readonly updateBulkProductsUseCase: UpdateBulkProductsUseCase,
  ) {}

  @Get()
  findAll(@Query() queryParams: GetProductsDto) {
    return this.getAllProductsUseCase.execute(queryParams);
  }

  @Post('bulk')
  createBulk(@Body() bulkCreateProductDto: BulkCreateProductDto) {
    return this.createBulkProductsUseCase.execute(bulkCreateProductDto);
  }

  @Put('bulk')
  updateBulk(@Body() bulkUpdateProductDto: BulkUpdateProductDto) {
    return this.updateBulkProductsUseCase.execute(bulkUpdateProductDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.getProductByIdUseCase.execute(id);
  }

  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.createProductUseCase.execute(createProductDto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.updateProductUseCase.execute(id, updateProductDto);
  }
}
