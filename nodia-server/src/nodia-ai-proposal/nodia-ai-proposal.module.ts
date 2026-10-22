import { NodiaAiSecurePreparationModule } from '../nodia-ai-secure-preparation/nodia-ai-secure-preparation.module.js';
import { NodiaAiPreferenceOperationsModule } from '../nodia-ai-preference/nodia-ai-preference-operations.module.js';
import {
  NODIA_AI_PREFERENCE_OPERATIONS,
  type NodiaAiPreferenceOperation,
} from '../nodia-ai-preference/types/preference.types.js';
import {
  NODIA_AI_SECURE_OPERATIONS,
  type NodiaAiSecureOperation,
} from './types/secure-operation.types.js';
import { NodiaAiProviderOperationsModule } from '../nodia-ai-provider-operations/nodia-ai-provider-operations.module.js';
import {
  NODIA_AI_PROVIDER_OPERATIONS,
  type NodiaAiProviderOperation,
} from '../nodia-ai-provider-operations/types/provider-operation.types.js';
import {
  NODIA_AI_CORE_OPERATIONS,
  type NodiaAiCoreOperation,
} from '../nodia-ai-core-operations/types/core-operation.types.js';
import { NodiaAiCoreOperationsModule } from '../nodia-ai-core-operations/nodia-ai-core-operations.module.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { readFileSync } from 'node:fs';
import { NodiaAiAuthorizationModule } from '../nodia-ai/nodia-ai-authorization.module.js';
import { NodiaAiRuntimePolicyModule } from '../nodia-ai-runtime/config/runtime-policy.module.js';
import { NodiaAiConversation } from '../nodia-ai-conversation/entities/nodia-ai-conversation.entity.js';
import { NodiaAiConversationService } from '../nodia-ai-conversation/nodia-ai-conversation.service.js';
import { AuthorizeNodiaAiConversationUseCase } from '../nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case.js';
import { FinanceCategory } from '../finance-category/entities/finance-category.entity.js';
import { FinanceMovement } from '../finance-movement/entities/finance-movement.entity.js';
import { FinanceObligation } from '../finance-obligation/entities/finance-obligation.entity.js';
import { FinanceLedgerService } from '../finance-obligation/finance-ledger.service.js';
import { NodiaAiDraft } from './entities/nodia-ai-draft.entity.js';
import { NodiaAiProposal } from './entities/nodia-ai-proposal.entity.js';
import { NodiaAiProposalRevision } from './entities/nodia-ai-proposal-revision.entity.js';
import { NodiaAiProposalStep } from './entities/nodia-ai-proposal-step.entity.js';
import { NodiaAiProposalService } from './nodia-ai-proposal.service.js';
import { CanonicalizeNodiaAiProposalUseCase } from './use-case/canonicalize-nodia-ai-proposal.use-case.js';
import {
  ValidateNodiaAiProposalUseCase,
  NODIA_AI_PROPOSAL_COMMON_SCHEMA,
} from './use-case/validate-nodia-ai-proposal.use-case.js';
import { NODIA_AI_PROPOSAL_PREPARERS } from './types/proposal-preparer.types.js';
import { PrepareNodiaAiFinanceMovementUseCase } from './use-case/prepare-nodia-ai-finance-movement.use-case.js';
import { PrepareNodiaAiProposalUseCase } from './use-case/prepare-nodia-ai-proposal.use-case.js';
import { PrepareNodiaAiWorkflowUseCase } from './use-case/prepare-nodia-ai-workflow.use-case.js';
import { PrepareNodiaAiRemainingWorkflowUseCase } from './use-case/prepare-nodia-ai-remaining-workflow.use-case.js';
import { GetNodiaAiProposalUseCase } from './use-case/get-nodia-ai-proposal.use-case.js';
import { UpdateNodiaAiProposalUseCase } from './use-case/update-nodia-ai-proposal.use-case.js';
import { CancelNodiaAiProposalUseCase } from './use-case/cancel-nodia-ai-proposal.use-case.js';
import { NodiaAiProposalController } from './nodia-ai-proposal.controller.js';
import { NodiaAiFinanceCatalogModule } from '../nodia-ai-finance-catalog/nodia-ai-finance-catalog.module.js';
import { BuildNodiaAiFinanceCatalogOperationsUseCase } from '../nodia-ai-finance-catalog/use-case/build-nodia-ai-finance-catalog-operations.use-case.js';
import { NodiaAiFinanceLedgerModule } from '../nodia-ai-finance-ledger/nodia-ai-finance-ledger.module.js';
import { BuildNodiaAiFinanceLedgerOperationsUseCase } from '../nodia-ai-finance-ledger/use-case/build-nodia-ai-finance-ledger-operations.use-case.js';
import {
  NODIA_AI_FINANCE_OPERATIONS,
  type NodiaAiFinanceOperation,
} from '../nodia-ai-finance-effect/types/financial-operation.types.js';
import {
  NODIA_AI_BUSINESS_OPERATIONS,
  type NodiaAiNativeOperation,
} from './types/native-operation.types.js';
import { NodiaAiBusinessCatalogModule } from '../nodia-ai-business-catalog/nodia-ai-business-catalog.module.js';
import { BuildNodiaAiBusinessCatalogOperationsUseCase } from '../nodia-ai-business-catalog/use-case/build-nodia-ai-business-catalog-operations.use-case.js';
import { NodiaAiSupplierOperationsModule } from '../nodia-ai-supplier-operations/nodia-ai-supplier-operations.module.js';
import { BuildNodiaAiSupplierOperationsUseCase } from '../nodia-ai-supplier-operations/use-case/build-nodia-ai-supplier-operations.use-case.js';
import { NodiaAiInvoiceOperationsModule } from '../nodia-ai-invoice-operations/nodia-ai-invoice-operations.module.js';
import { BuildNodiaAiInvoiceOperationsUseCase } from '../nodia-ai-invoice-operations/use-case/build-nodia-ai-invoice-operations.use-case.js';
import { NodiaAiRentalConfigurationModule } from '../nodia-ai-rental-configuration/nodia-ai-rental-configuration.module.js';
import { NodiaAiRentalReservationModule } from '../nodia-ai-rental-reservation/nodia-ai-rental-reservation.module.js';
import { NodiaAiRentalMoneyModule } from '../nodia-ai-rental-money/nodia-ai-rental-money.module.js';
import { NodiaAiRentalOperationsModule } from '../nodia-ai-rental-operations/nodia-ai-rental-operations.module.js';
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

/** Owns M2 and native preparation only. No ToolRegistry/ContextModule import or publication side effect. */
@Module({
  imports: [
    NodiaAiSecurePreparationModule,
    NodiaAiPreferenceOperationsModule,
    NodiaAiAuthorizationModule,
    NodiaAiRuntimePolicyModule,
    NodiaAiFinanceCatalogModule,
    NodiaAiFinanceLedgerModule,
    NodiaAiBusinessCatalogModule,
    NodiaAiSupplierOperationsModule,
    NodiaAiInvoiceOperationsModule,
    NodiaAiRentalConfigurationModule,
    NodiaAiRentalReservationModule,
    NodiaAiRentalMoneyModule,
    NodiaAiRentalOperationsModule,
    NodiaAiCoreOperationsModule,
    NodiaAiProviderOperationsModule,
    TypeOrmModule.forFeature([
      NodiaAiConversation,
      NodiaAiDraft,
      NodiaAiProposal,
      NodiaAiProposalRevision,
      NodiaAiProposalStep,
      FinanceCategory,
      FinanceMovement,
      FinanceObligation,
    ]),
  ],
  providers: [
    NodiaAiProposalService,
    NodiaAiConversationService,
    AuthorizeNodiaAiConversationUseCase,
    FinanceLedgerService,
    PrepareNodiaAiFinanceMovementUseCase,
    CanonicalizeNodiaAiProposalUseCase,
    ValidateNodiaAiProposalUseCase,
    PrepareNodiaAiProposalUseCase,
    PrepareNodiaAiWorkflowUseCase,
    PrepareNodiaAiRemainingWorkflowUseCase,
    GetNodiaAiProposalUseCase,
    UpdateNodiaAiProposalUseCase,
    CancelNodiaAiProposalUseCase,
    {
      provide: NODIA_AI_FINANCE_OPERATIONS,
      inject: [
        BuildNodiaAiFinanceCatalogOperationsUseCase,
        BuildNodiaAiFinanceLedgerOperationsUseCase,
      ],
      useFactory: (
        catalogs: BuildNodiaAiFinanceCatalogOperationsUseCase,
        ledger: BuildNodiaAiFinanceLedgerOperationsUseCase,
      ) => Object.freeze([...catalogs.operations, ...ledger.operations]),
    },
    {
      provide: NODIA_AI_BUSINESS_OPERATIONS,
      inject: [
        BuildNodiaAiBusinessCatalogOperationsUseCase,
        BuildNodiaAiSupplierOperationsUseCase,
        BuildNodiaAiInvoiceOperationsUseCase,
      ],
      useFactory: (
        business: BuildNodiaAiBusinessCatalogOperationsUseCase,
        suppliers: BuildNodiaAiSupplierOperationsUseCase,
        invoices: BuildNodiaAiInvoiceOperationsUseCase,
      ) =>
        Object.freeze([
          ...business.operations,
          ...suppliers.operations,
          ...invoices.operations,
        ]),
    },
    {
      provide: NODIA_AI_PROPOSAL_PREPARERS,
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
      ) => [
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
      ],
    },
    {
      provide: NODIA_AI_PROPOSAL_COMMON_SCHEMA,
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
  controllers: [NodiaAiProposalController],
  exports: [
    NodiaAiSecurePreparationModule,
    NodiaAiPreferenceOperationsModule,
    NODIA_AI_PROPOSAL_COMMON_SCHEMA,
    NODIA_AI_FINANCE_OPERATIONS,
    NODIA_AI_BUSINESS_OPERATIONS,
    NodiaAiRentalConfigurationModule,
    NodiaAiRentalReservationModule,
    NodiaAiRentalMoneyModule,
    NodiaAiRentalOperationsModule,
    NodiaAiCoreOperationsModule,
    NodiaAiProviderOperationsModule,
    PrepareNodiaAiFinanceMovementUseCase,
    CanonicalizeNodiaAiProposalUseCase,
    NodiaAiProposalService,
    GetNodiaAiProposalUseCase,
    PrepareNodiaAiProposalUseCase,
    PrepareNodiaAiWorkflowUseCase,
    PrepareNodiaAiRemainingWorkflowUseCase,
    ValidateNodiaAiProposalUseCase,
  ],
})
export class NodiaAiProposalModule {}
