import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RentalCommonModule } from '../rental-common/rental-common.module.js';
import { RentalPaymentController } from './rental-payment.controller.js';
import { CreateRentalPaymentUseCase } from './use-case/create-rental-payment.use-case.js';
import {
  GetRentalPaymentsUseCase,
  GetRentalPaymentUseCase,
} from './use-case/get-rental-payments.use-case.js';
import { VoidRentalPaymentUseCase } from './use-case/void-rental-payment.use-case.js';
import { RentalPaymentService } from './rental-payment.service.js';
import { RentalPayment } from './entities/rental-payment.entity.js';
@Module({
  imports: [RentalCommonModule, TypeOrmModule.forFeature([RentalPayment])],
  controllers: [RentalPaymentController],
  providers: [
    RentalPaymentService,
    CreateRentalPaymentUseCase,
    GetRentalPaymentsUseCase,
    GetRentalPaymentUseCase,
    VoidRentalPaymentUseCase,
  ],
  exports: [
    RentalPaymentService,
    CreateRentalPaymentUseCase,
    GetRentalPaymentsUseCase,
    GetRentalPaymentUseCase,
    VoidRentalPaymentUseCase,
  ],
})
export class RentalPaymentModule {}
