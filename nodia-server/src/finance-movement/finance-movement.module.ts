import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceMovement } from './entities/finance-movement.entity.js';
import { FinanceObligationModule } from '../finance-obligation/finance-obligation.module.js';
import { FinanceMovementController } from './finance-movement.controller.js';
import { FinanceMovementService } from './finance-movement.service.js';
import { CreateFinanceMovementUseCase } from './use-case/create-finance-movement.use-case.js';
import { UpdateFinanceMovementUseCase } from './use-case/update-finance-movement.use-case.js';
import { GetFinanceMovementsUseCase } from './use-case/get-finance-movements.use-case.js';
import { GetFinanceMovementByIdUseCase } from './use-case/get-finance-movement-by-id.use-case.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([FinanceMovement]),
    FinanceObligationModule,
  ],
  controllers: [FinanceMovementController],
  providers: [
    FinanceMovementService,
    CreateFinanceMovementUseCase,
    UpdateFinanceMovementUseCase,
    GetFinanceMovementsUseCase,
    GetFinanceMovementByIdUseCase,
  ],
  exports: [FinanceMovementService],
})
export class FinanceMovementModule {}
