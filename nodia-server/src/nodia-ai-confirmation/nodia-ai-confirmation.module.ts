import {
  NODIA_AI_PROVIDER_OPERATIONS,
  type NodiaAiProviderOperation,
} from '../nodia-ai-provider-operations/types/provider-operation.types.js';
import {
  NODIA_AI_PREFERENCE_OPERATIONS,
  type NodiaAiPreferenceOperation,
} from '../nodia-ai-preference/types/preference.types.js';
import {
  NODIA_AI_SECURE_OPERATIONS,
  type NodiaAiSecureOperation,
} from '../nodia-ai-proposal/types/secure-operation.types.js';
import {
  NODIA_AI_CORE_OPERATIONS,
  type NodiaAiCoreOperation,
} from '../nodia-ai-core-operations/types/core-operation.types.js';
import { Module } from '@nestjs/common';
import {
  NODIA_AI_RENTAL_MONEY_OPERATIONS,
  type NodiaAiRentalMoneyOperation,
} from '../nodia-ai-rental-money/types/rental-money-operation.types.js';
import {
  NODIA_AI_RENTAL_OPERATIONS,
  type NodiaAiRentalOperation,
} from '../nodia-ai-rental-operations/types/rental-operation.types.js';
import {
  NODIA_AI_RENTAL_RESERVATION_OPERATIONS,
  type NodiaAiRentalReservationOperation,
} from '../nodia-ai-rental-reservation/types/rental-reservation-operation.types.js';
import {
  NODIA_AI_RENTAL_CONFIGURATION_OPERATIONS,
  type NodiaAiRentalConfigurationOperation,
} from '../nodia-ai-rental-configuration/types/rental-configuration-operation.types.js';
import {
  NODIA_AI_BUSINESS_OPERATIONS,
  type NodiaAiNativeOperation,
} from '../nodia-ai-proposal/types/native-operation.types.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { readFileSync } from 'node:fs';
import { NodiaAiProposalModule } from '../nodia-ai-proposal/nodia-ai-proposal.module.js';
import { PrepareNodiaAiFinanceMovementUseCase } from '../nodia-ai-proposal/use-case/prepare-nodia-ai-finance-movement.use-case.js';
import {
  NODIA_AI_FINANCE_OPERATIONS,
  type NodiaAiFinanceOperation,
} from '../nodia-ai-finance-effect/types/financial-operation.types.js';
import { NodiaAiRuntimePolicyModule } from '../nodia-ai-runtime/config/runtime-policy.module.js';
import { NodiaAiConfirmationChallenge } from './entities/nodia-ai-confirmation-challenge.entity.js';
import { NodiaAiExecution } from './entities/nodia-ai-execution.entity.js';
import { NodiaAiExecutionStep } from './entities/nodia-ai-execution-step.entity.js';
import { NodiaAiConfirmationService } from './nodia-ai-confirmation.service.js';
import { NodiaAiConfirmationController } from './nodia-ai-confirmation.controller.js';
import { NodiaAiOperationController } from './nodia-ai-operation.controller.js';
import { NODIA_AI_EXECUTION_ADMISSION } from './types/execution-admission.types.js';
import { NodiaAiConfirmationAvailabilityUseCase } from './use-case/nodia-ai-confirmation-availability.use-case.js';
import {
  NODIA_AI_CONFIRMATION_COMMON_SCHEMA,
  ValidateNodiaAiConfirmationUseCase,
} from './use-case/validate-nodia-ai-confirmation.use-case.js';
import { CreateNodiaAiConfirmationChallengeUseCase } from './use-case/create-nodia-ai-confirmation-challenge.use-case.js';
import { ConfirmNodiaAiProposalUseCase } from './use-case/confirm-nodia-ai-proposal.use-case.js';
import { GetNodiaAiExecutionUseCase } from './use-case/get-nodia-ai-execution.use-case.js';
import { ControlNodiaAiExecutionUseCase } from './use-case/control-nodia-ai-execution.use-case.js';
/** Native admission metadata only. No model invocation or MCP publication side effect. */
@Module({
  imports: [
    NodiaAiProposalModule,
    NodiaAiRuntimePolicyModule,
    TypeOrmModule.forFeature([
      NodiaAiConfirmationChallenge,
      NodiaAiExecution,
      NodiaAiExecutionStep,
    ]),
  ],
  controllers: [NodiaAiConfirmationController, NodiaAiOperationController],
  providers: [
    NodiaAiConfirmationService,
    NodiaAiConfirmationAvailabilityUseCase,
    ValidateNodiaAiConfirmationUseCase,
    CreateNodiaAiConfirmationChallengeUseCase,
    ConfirmNodiaAiProposalUseCase,
    GetNodiaAiExecutionUseCase,
    ControlNodiaAiExecutionUseCase,
    {
      provide: NODIA_AI_EXECUTION_ADMISSION,
      inject: [
        PrepareNodiaAiFinanceMovementUseCase,
        NODIA_AI_FINANCE_OPERATIONS,
        NODIA_AI_BUSINESS_OPERATIONS,
        NODIA_AI_RENTAL_CONFIGURATION_OPERATIONS,
        NODIA_AI_RENTAL_RESERVATION_OPERATIONS,
        NODIA_AI_RENTAL_MONEY_OPERATIONS,
        NODIA_AI_RENTAL_OPERATIONS,
        NODIA_AI_CORE_OPERATIONS,
        NODIA_AI_PROVIDER_OPERATIONS,
        NODIA_AI_SECURE_OPERATIONS,
        NODIA_AI_PREFERENCE_OPERATIONS,
      ],
      useFactory: (
        finance: PrepareNodiaAiFinanceMovementUseCase,
        operations: readonly NodiaAiFinanceOperation[],
        business: readonly NodiaAiNativeOperation[],
        rental: readonly NodiaAiRentalConfigurationOperation[],
        reservations: readonly NodiaAiRentalReservationOperation[],
        money: readonly NodiaAiRentalMoneyOperation[],
        rentalOperations: readonly NodiaAiRentalOperation[],
        core: readonly NodiaAiCoreOperation[],
        providers: readonly NodiaAiProviderOperation[],
        secure: readonly NodiaAiSecureOperation[],
        preferences: readonly NodiaAiPreferenceOperation[],
      ) =>
        Object.freeze(
          [
            finance,
            ...operations,
            ...business,
            ...rental,
            ...reservations,
            ...money,
            ...rentalOperations,
            ...core,
            ...providers,
            ...secure,
            ...preferences,
          ].map((port) =>
            Object.freeze({
              toolName: port.toolName,
              contractHash: port.contractHash,
              catalogVersion: port.catalogVersion,
              bindableFields: port.bindableFields,
              outputKeys: port.outputKeys,
            }),
          ),
        ),
    },
    {
      provide: NODIA_AI_CONFIRMATION_COMMON_SCHEMA,
      useFactory: () =>
        readFileSync(
          new URL(
            '../nodia-ai-tools/config/common-schema.json',
            import.meta.url,
          ),
          'utf8',
        ),
    },
  ],
  exports: [
    NodiaAiConfirmationService,
    ValidateNodiaAiConfirmationUseCase,
    NodiaAiConfirmationAvailabilityUseCase,
    CreateNodiaAiConfirmationChallengeUseCase,
    ConfirmNodiaAiProposalUseCase,
    GetNodiaAiExecutionUseCase,
    ControlNodiaAiExecutionUseCase,
  ],
})
export class NodiaAiConfirmationModule {}
