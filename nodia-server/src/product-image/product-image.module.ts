import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../common/storage/storage.module.js';
import { Product } from '../product/entities/product.entity.js';
import { ProductLog } from '../product/entities/product-log.entity.js';
import { ProductImage } from './entities/product-image.entity.js';
import { ProductImageService } from './product-image.service.js';
import { ProductImageController } from './product-image.controller.js';
import { ManageProductImageUseCase } from './use-case/manage-product-image.use-case.js';
import { ProductImageRecoveryWorker } from './product-image-recovery.worker.js';

@Module({
  imports: [
    AuthorizationModule,
    StorageModule,
    TypeOrmModule.forFeature([Product, ProductLog, ProductImage]),
  ],
  controllers: [ProductImageController],
  providers: [
    ProductImageService,
    ManageProductImageUseCase,
    ProductImageRecoveryWorker,
  ],
  exports: [ProductImageService, ManageProductImageUseCase],
})
export class ProductImageModule {}
