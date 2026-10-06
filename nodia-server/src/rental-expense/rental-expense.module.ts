import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RentalCommonModule } from '../rental-common/rental-common.module.js';
import { RentalExpenseController } from './rental-expense.controller.js';
import { CreateRentalExpenseUseCase } from './use-case/create-rental-expense.use-case.js';
import {
  GetRentalExpensesUseCase,
  GetRentalExpenseUseCase,
} from './use-case/get-rental-expenses.use-case.js';
import { PayRentalExpenseUseCase } from './use-case/pay-rental-expense.use-case.js';
import { UpdateRentalExpenseUseCase } from './use-case/update-rental-expense.use-case.js';
import { VoidRentalExpenseUseCase } from './use-case/void-rental-expense.use-case.js';
import { RentalExpenseService } from './rental-expense.service.js';
import { RentalExpense } from './entities/rental-expense.entity.js';
@Module({
  imports: [RentalCommonModule, TypeOrmModule.forFeature([RentalExpense])],
  controllers: [RentalExpenseController],
  providers: [
    RentalExpenseService,
    CreateRentalExpenseUseCase,
    GetRentalExpensesUseCase,
    GetRentalExpenseUseCase,
    PayRentalExpenseUseCase,
    UpdateRentalExpenseUseCase,
    VoidRentalExpenseUseCase,
  ],
  exports: [
    RentalExpenseService,
    CreateRentalExpenseUseCase,
    GetRentalExpensesUseCase,
    GetRentalExpenseUseCase,
    PayRentalExpenseUseCase,
    UpdateRentalExpenseUseCase,
    VoidRentalExpenseUseCase,
  ],
})
export class RentalExpenseModule {}
