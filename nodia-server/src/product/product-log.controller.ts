import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
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
import { QueryProductLogsUseCase } from './use-case/query-product-logs.use-case.js';
import { QueryProductLogsDto } from './dto/query-product-logs.dto.js';

@Controller(['product-log', 'product-logs'])
export class ProductLogController {
  constructor(
    private readonly getAllProductLogsUseCase: GetAllProductLogsUseCase,
    private readonly getProductLogByIdUseCase: GetProductLogByIdUseCase,
    private readonly createProductLogUseCase: CreateProductLogUseCase,
    private readonly createBulkProductLogsUseCase: CreateBulkProductLogsUseCase,
    private readonly updateProductLogUseCase: UpdateProductLogUseCase,
    private readonly updateBulkProductLogsUseCase: UpdateBulkProductLogsUseCase,
    private readonly queryProductLogsUseCase: QueryProductLogsUseCase,
  ) {}

  @Get()
  findAll(
    @Query() queryParams: GetProductLogsDto,
    @Req() request: AuthRequest,
  ) {
    return this.getAllProductLogsUseCase.execute(
      queryParams,
      actorReference(request.auth),
    );
  }

  @Post(['query', 'by-products'])
  query(
    @Body() queryProductLogsDto: QueryProductLogsDto,
    @Req() request: AuthRequest,
  ) {
    return this.queryProductLogsUseCase.execute(
      queryProductLogsDto,
      actorReference(request.auth),
    );
  }

  @Post('bulk')
  createBulk(
    @Body() bulkCreateProductLogDto: BulkCreateProductLogDto,
    @Req() request: AuthRequest,
  ) {
    return this.createBulkProductLogsUseCase.execute(
      bulkCreateProductLogDto,
      undefined,
      actorReference(request.auth),
    );
  }

  @Put('bulk')
  updateBulk(
    @Body() bulkUpdateProductLogDto: BulkUpdateProductLogDto,
    @Req() request: AuthRequest,
  ) {
    return this.updateBulkProductLogsUseCase.execute(
      bulkUpdateProductLogDto,
      undefined,
      actorReference(request.auth),
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() request: AuthRequest) {
    return this.getProductLogByIdUseCase.execute(
      id,
      actorReference(request.auth),
    );
  }

  @Post()
  create(
    @Body() createProductLogDto: CreateProductLogDto,
    @Req() request: AuthRequest,
  ) {
    return this.createProductLogUseCase.execute(
      createProductLogDto,
      undefined,
      actorReference(request.auth),
    );
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateProductLogDto: UpdateProductLogDto,
    @Req() request: AuthRequest,
  ) {
    return this.updateProductLogUseCase.execute(
      id,
      updateProductLogDto,
      undefined,
      actorReference(request.auth),
    );
  }
}
