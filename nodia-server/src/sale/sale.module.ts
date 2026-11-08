import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { Sale } from './entities/sale.entity.js';
import { SaleItem } from './entities/sale-item.entity.js';
import { SaleEvent } from './entities/sale-event.entity.js';
import { SaleMutationRequest } from './entities/sale-mutation-request.entity.js';
import { SaleService } from './sale.service.js';
import { MutateSaleUseCase } from './use-case/mutate-sale.use-case.js';
import { ReadSalesUseCase } from './use-case/read-sales.use-case.js';
import { SaleController } from './sale.controller.js';

@Module({
  imports: [
    AuthorizationModule,
    TypeOrmModule.forFeature([Sale, SaleItem, SaleEvent, SaleMutationRequest]),
  ],
  controllers: [SaleController],
  providers: [SaleService, MutateSaleUseCase, ReadSalesUseCase],
  exports: [MutateSaleUseCase, ReadSalesUseCase],
})
export class SaleModule {}
