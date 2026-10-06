import { Module } from '@nestjs/common';
import { RentalTransactionService } from './rental-transaction.service.js';
import { RentalTransportGuard } from './rental-transport.guard.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RentalAuditEvent } from '../rental-audit/entities/rental-audit-event.entity.js';
import { RentalOperation } from '../rental-operation/entities/rental-operation.entity.js';
import { RentalAuditService } from '../rental-audit/rental-audit.service.js';
import { GetRentalAuditEventsUseCase } from '../rental-audit/use-case/get-rental-audit-events.use-case.js';
import { GetRentalOperationUseCase } from '../rental-operation/use-case/get-rental-operation.use-case.js';
import { RentalHistoryController } from './rental-history.controller.js';
import { RentalClock } from './rental-clock.js';
@Module({
  imports: [TypeOrmModule.forFeature([RentalAuditEvent, RentalOperation])],
  controllers: [RentalHistoryController],
  providers: [
    RentalClock,
    RentalTransactionService,
    RentalTransportGuard,
    RentalAuditService,
    GetRentalAuditEventsUseCase,
    GetRentalOperationUseCase,
  ],
  exports: [RentalTransactionService, RentalTransportGuard],
})
export class RentalCommonModule {}
