import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { CreateProductLogDto } from './dto/create-product-log.dto.js';
import { BulkCreateProductLogDto } from './dto/bulk-create-product-log.dto.js';
import { UpdateProductLogDto } from './dto/update-product-log.dto.js';
import { BulkUpdateProductLogDto } from './dto/bulk-update-product-log.dto.js';
import { GetProductLogsDto } from './dto/get-product-logs.dto.js';
import { GetAllProductLogsUseCase } from './use-case/get-all-product-logs.use-case.js';
import { GetProductLogByIdUseCase } from './use-case/get-product-log-by-id.use-case.js';
import { CreateProductLogUseCase } from './use-case/create-product-log.use-case.js';
import { CreateBulkProductLogsUseCase } from './use-case/create-bulk-product-logs.use-case.js';
import { UpdateProductLogUseCase } from './use-case/update-product-log.use-case.js';
import { UpdateBulkProductLogsUseCase } from './use-case/update-bulk-product-logs.use-case.js';

@Controller(['product-log', 'product-logs'])
export class ProductLogController {
  constructor(
    private readonly getAllProductLogsUseCase: GetAllProductLogsUseCase,
    private readonly getProductLogByIdUseCase: GetProductLogByIdUseCase,
    private readonly createProductLogUseCase: CreateProductLogUseCase,
    private readonly createBulkProductLogsUseCase: CreateBulkProductLogsUseCase,
    private readonly updateProductLogUseCase: UpdateProductLogUseCase,
    private readonly updateBulkProductLogsUseCase: UpdateBulkProductLogsUseCase,
  ) {}

  @Get()
  findAll(@Query() queryParams: GetProductLogsDto) {
    return this.getAllProductLogsUseCase.execute(queryParams);
  }

  @Post('bulk')
  createBulk(@Body() bulkCreateProductLogDto: BulkCreateProductLogDto) {
    return this.createBulkProductLogsUseCase.execute(bulkCreateProductLogDto);
  }

  @Put('bulk')
  updateBulk(@Body() bulkUpdateProductLogDto: BulkUpdateProductLogDto) {
    return this.updateBulkProductLogsUseCase.execute(bulkUpdateProductLogDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.getProductLogByIdUseCase.execute(id);
  }

  @Post()
  create(@Body() createProductLogDto: CreateProductLogDto) {
    return this.createProductLogUseCase.execute(createProductLogDto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateProductLogDto: UpdateProductLogDto) {
    return this.updateProductLogUseCase.execute(id, updateProductLogDto);
  }
}
