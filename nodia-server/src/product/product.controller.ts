import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Header,
  Req,
} from '@nestjs/common';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { BulkCreateProductDto } from './dto/bulk-create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { BulkUpdateProductDto } from './dto/bulk-update-product.dto.js';
import { GetProductsDto } from './dto/get-products.dto.js';
import { ExportProductsCsvDto } from './dto/export-products-csv.dto.js';
import { GetAllProductsUseCase } from './use-case/get-all-products.use-case.js';
import { GetProductByIdUseCase } from './use-case/get-product-by-id.use-case.js';
import { CreateProductUseCase } from './use-case/create-product.use-case.js';
import { CreateBulkProductsUseCase } from './use-case/create-bulk-products.use-case.js';
import { UpdateProductUseCase } from './use-case/update-product.use-case.js';
import { UpdateBulkProductsUseCase } from './use-case/update-bulk-products.use-case.js';
import { ExportProductsCsvUseCase } from './use-case/export-products-csv.use-case.js';
import { GetProductByBarcodeUseCase } from './use-case/get-product-by-barcode.use-case.js';
import {
  ProductBarcodeQueryDto,
  ProductAvailabilityQueryDto,
} from './dto/product-barcode-query.dto.js';
import { GetProductAvailabilityUseCase } from './use-case/get-product-availability.use-case.js';

@Controller(['product', 'products'])
export class ProductController {
  constructor(
    private readonly getAllProductsUseCase: GetAllProductsUseCase,
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    private readonly createProductUseCase: CreateProductUseCase,
    private readonly createBulkProductsUseCase: CreateBulkProductsUseCase,
    private readonly updateProductUseCase: UpdateProductUseCase,
    private readonly updateBulkProductsUseCase: UpdateBulkProductsUseCase,
    private readonly exportProductsCsvUseCase: ExportProductsCsvUseCase,
    private readonly getProductByBarcodeUseCase: GetProductByBarcodeUseCase,
    private readonly getProductAvailabilityUseCase: GetProductAvailabilityUseCase,
  ) {}

  @Get()
  findAll(@Query() queryParams: GetProductsDto, @Req() request: AuthRequest) {
    return this.getAllProductsUseCase.execute(
      queryParams,
      actorReference(request.auth),
    );
  }

  @Post('bulk')
  createBulk(
    @Body() bulkCreateProductDto: BulkCreateProductDto,
    @Req() request: AuthRequest,
  ) {
    return this.createBulkProductsUseCase.execute(
      bulkCreateProductDto,
      undefined,
      actorReference(request.auth),
    );
  }

  @Put('bulk')
  updateBulk(
    @Body() bulkUpdateProductDto: BulkUpdateProductDto,
    @Req() request: AuthRequest,
  ) {
    return this.updateBulkProductsUseCase.execute(
      bulkUpdateProductDto,
      undefined,
      actorReference(request.auth),
    );
  }

  @Get('export-csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="products.csv"')
  exportCsv(@Query() dto: ExportProductsCsvDto, @Req() request: AuthRequest) {
    return this.exportProductsCsvUseCase.execute(
      dto,
      undefined,
      actorReference(request.auth),
    );
  }

  @Get('by-barcode')
  byBarcode(
    @Query() query: ProductBarcodeQueryDto,
    @Req() request: AuthRequest,
  ) {
    return this.getProductByBarcodeUseCase.execute(
      query,
      actorReference(request.auth),
    );
  }

  @Get('availability-summary')
  availability(
    @Query() query: ProductAvailabilityQueryDto,
    @Req() request: AuthRequest,
  ) {
    return this.getProductAvailabilityUseCase.execute(
      query,
      actorReference(request.auth),
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() request: AuthRequest) {
    return this.getProductByIdUseCase.execute(id, actorReference(request.auth));
  }

  @Post()
  create(
    @Body() createProductDto: CreateProductDto,
    @Req() request: AuthRequest,
  ) {
    return this.createProductUseCase.execute(
      createProductDto,
      undefined,
      actorReference(request.auth),
    );
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @Req() request: AuthRequest,
  ) {
    return this.updateProductUseCase.execute(
      id,
      updateProductDto,
      undefined,
      actorReference(request.auth),
    );
  }
}
