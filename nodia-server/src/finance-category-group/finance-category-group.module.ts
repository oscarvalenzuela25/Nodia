import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceCategoryGroup } from './entities/finance-category-group.entity.js';
import { FinanceCategoryGroupMembership } from './entities/finance-category-group-membership.entity.js';
import { FinanceCategory } from '../finance-category/entities/finance-category.entity.js';
import { FinanceCategoryGroupController } from './finance-category-group.controller.js';
import { FinanceCategoryGroupService } from './finance-category-group.service.js';
import { GetFinanceCategoryGroupsUseCase } from './use-case/get-finance-category-groups.use-case.js';
import { GetFinanceCategoryGroupUseCase } from './use-case/get-finance-category-group.use-case.js';
import { CreateFinanceCategoryGroupUseCase } from './use-case/create-finance-category-group.use-case.js';
import { UpdateFinanceCategoryGroupUseCase } from './use-case/update-finance-category-group.use-case.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FinanceCategory,
      FinanceCategoryGroup,
      FinanceCategoryGroupMembership,
    ]),
  ],
  controllers: [FinanceCategoryGroupController],
  providers: [
    FinanceCategoryGroupService,
    GetFinanceCategoryGroupsUseCase,
    GetFinanceCategoryGroupUseCase,
    CreateFinanceCategoryGroupUseCase,
    UpdateFinanceCategoryGroupUseCase,
  ],
})
export class FinanceCategoryGroupModule {}
