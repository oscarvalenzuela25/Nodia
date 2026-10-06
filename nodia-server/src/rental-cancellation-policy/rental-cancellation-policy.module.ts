import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RentalCommonModule } from '../rental-common/rental-common.module.js';
import { RentalCancellationPolicyController } from './rental-cancellation-policy.controller.js';
import { CreateRentalCancellationPolicyUseCase } from './use-case/create-rental-cancellation-policy.use-case.js';
import { GetRentalCancellationPoliciesUseCase } from './use-case/get-rental-cancellation-policies.use-case.js';
import { GetRentalCancellationPolicyUseCase } from './use-case/get-rental-cancellation-policy.use-case.js';
import { UpdateRentalCancellationPolicyUseCase } from './use-case/update-rental-cancellation-policy.use-case.js';
import { RentalCancellationPolicyService } from './rental-cancellation-policy.service.js';
import { RentalCancellationRule } from './entities/rental-cancellation-policy-rule.entity.js';
import { RentalCancellationPolicy } from './entities/rental-cancellation-policy.entity.js';
@Module({
  imports: [
    RentalCommonModule,
    TypeOrmModule.forFeature([
      RentalCancellationRule,
      RentalCancellationPolicy,
    ]),
  ],
  controllers: [RentalCancellationPolicyController],
  providers: [
    RentalCancellationPolicyService,
    CreateRentalCancellationPolicyUseCase,
    GetRentalCancellationPoliciesUseCase,
    GetRentalCancellationPolicyUseCase,
    UpdateRentalCancellationPolicyUseCase,
  ],
  exports: [
    RentalCancellationPolicyService,
    CreateRentalCancellationPolicyUseCase,
    GetRentalCancellationPoliciesUseCase,
    GetRentalCancellationPolicyUseCase,
    UpdateRentalCancellationPolicyUseCase,
  ],
})
export class RentalCancellationPolicyModule {}
