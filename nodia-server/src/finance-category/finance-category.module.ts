import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceCategory } from './entities/finance-category.entity.js';
import { FinanceCategoryController } from './finance-category.controller.js';
import { FinanceCategoryService } from './finance-category.service.js';
import { GetFinanceCategoriesUseCase } from './use-case/get-finance-categories.use-case.js';
import { GetFinanceCategoryUseCase } from './use-case/get-finance-category.use-case.js';
import { CreateFinanceCategoryUseCase } from './use-case/create-finance-category.use-case.js';
import { UpdateFinanceCategoryUseCase } from './use-case/update-finance-category.use-case.js';

@Module({
  imports: [TypeOrmModule.forFeature([FinanceCategory])],
  controllers: [FinanceCategoryController],
  providers: [
    FinanceCategoryService,
    GetFinanceCategoriesUseCase,
    GetFinanceCategoryUseCase,
    CreateFinanceCategoryUseCase,
    UpdateFinanceCategoryUseCase,
  ],
  exports: [FinanceCategoryService],
})
export class FinanceCategoryModule {}
