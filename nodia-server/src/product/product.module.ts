import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity.js';
import { ProductLog } from './entities/product-log.entity.js';
import { ProductService } from './product.service.js';
import { ProductController } from './product.controller.js';
import { ProductLogController } from './product-log.controller.js';

// Product Use Cases
import { GetAllProductsUseCase } from './use-case/get-all-products.use-case.js';
import { GetProductByIdUseCase } from './use-case/get-product-by-id.use-case.js';
import { CreateProductUseCase } from './use-case/create-product.use-case.js';
import { CreateBulkProductsUseCase } from './use-case/create-bulk-products.use-case.js';
import { UpdateProductUseCase } from './use-case/update-product.use-case.js';
import { UpdateBulkProductsUseCase } from './use-case/update-bulk-products.use-case.js';
import { ExportProductsCsvUseCase } from './use-case/export-products-csv.use-case.js';

// ProductLog Use Cases
import { GetAllProductLogsUseCase } from './use-case/get-all-product-logs.use-case.js';
import { GetProductLogByIdUseCase } from './use-case/get-product-log-by-id.use-case.js';
import { CreateProductLogUseCase } from './use-case/create-product-log.use-case.js';
import { CreateBulkProductLogsUseCase } from './use-case/create-bulk-product-logs.use-case.js';
import { UpdateProductLogUseCase } from './use-case/update-product-log.use-case.js';
import { UpdateBulkProductLogsUseCase } from './use-case/update-bulk-product-logs.use-case.js';
import { QueryProductLogsUseCase } from './use-case/query-product-logs.use-case.js';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductLog])],
  controllers: [ProductController, ProductLogController],
  providers: [
    ProductService,
    // Products
    GetAllProductsUseCase,
    GetProductByIdUseCase,
    CreateProductUseCase,
    CreateBulkProductsUseCase,
    UpdateProductUseCase,
    UpdateBulkProductsUseCase,
    ExportProductsCsvUseCase,
    // ProductLogs
    GetAllProductLogsUseCase,
    GetProductLogByIdUseCase,
    CreateProductLogUseCase,
    CreateBulkProductLogsUseCase,
    UpdateProductLogUseCase,
    UpdateBulkProductLogsUseCase,
    QueryProductLogsUseCase,
  ],
  exports: [
    ProductService,
    GetAllProductsUseCase,
    GetProductByIdUseCase,
    CreateProductUseCase,
    CreateBulkProductsUseCase,
    UpdateProductUseCase,
    UpdateBulkProductsUseCase,
    ExportProductsCsvUseCase,
    GetAllProductLogsUseCase,
    GetProductLogByIdUseCase,
    CreateProductLogUseCase,
    CreateBulkProductLogsUseCase,
    UpdateProductLogUseCase,
    UpdateBulkProductLogsUseCase,
    QueryProductLogsUseCase,
  ],
})
export class ProductModule {}
