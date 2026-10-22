import {
  NODIA_AI_PROVIDER_OPERATIONS,
  type NodiaAiProviderOperation,
} from '../../nodia-ai-provider-operations/types/provider-operation.types.js';
import {
  NODIA_AI_PREFERENCE_OPERATIONS,
  type NodiaAiPreferenceOperation,
} from '../../nodia-ai-preference/types/preference.types.js';
import {
  NODIA_AI_CORE_OPERATIONS,
  type NodiaAiCoreOperation,
} from '../../nodia-ai-core-operations/types/core-operation.types.js';
import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service.js';
import { ExecuteNodiaAiFinanceEffectUseCase } from '../../nodia-ai-finance-effect/use-case/execute-nodia-ai-finance-effect.use-case.js';
import { nodiaAiFinanceOperationIdentity } from '../../nodia-ai-finance-effect/types/financial-operation.types.js';
import {
  nodiaAiBusinessOperationIdentity,
  nodiaAiRentalOperationIdentity,
  nodiaAiCoreOperationIdentity,
  nodiaAiProviderOperationIdentity,
} from '../../nodia-ai-proposal/types/local-operation.types.js';
import {
  NODIA_AI_RENTAL_MONEY_OPERATIONS,
  type NodiaAiRentalMoneyOperation,
} from '../../nodia-ai-rental-money/types/rental-money-operation.types.js';
import {
  NODIA_AI_RENTAL_OPERATIONS,
  type NodiaAiRentalOperation,
} from '../../nodia-ai-rental-operations/types/rental-operation.types.js';
import {
  NODIA_AI_RENTAL_RESERVATION_OPERATIONS,
  type NodiaAiRentalReservationOperation,
} from '../../nodia-ai-rental-reservation/types/rental-reservation-operation.types.js';
import {
  NODIA_AI_RENTAL_CONFIGURATION_OPERATIONS,
  type NodiaAiRentalConfigurationOperation,
} from '../../nodia-ai-rental-configuration/types/rental-configuration-operation.types.js';
import {
  NODIA_AI_BUSINESS_OPERATIONS,
  type NodiaAiNativeOperation,
} from '../../nodia-ai-proposal/types/native-operation.types.js';
import type {
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';

type RentalPort =
  | NodiaAiRentalConfigurationOperation
  | NodiaAiRentalReservationOperation
  | NodiaAiRentalMoneyOperation
  | NodiaAiRentalOperation;

@Injectable()
export class ExecuteNodiaAiLocalEffectUseCase {
  private readonly ports: ReadonlyMap<string, NodiaAiNativeOperation>;
  private readonly providerPorts: ReadonlyMap<string, NodiaAiProviderOperation>;
  private readonly preferencePorts: ReadonlyMap<
    string,
    NodiaAiPreferenceOperation
  >;
  private readonly corePorts: ReadonlyMap<string, NodiaAiCoreOperation>;
  private readonly rentalPorts: ReadonlyMap<string, RentalPort>;
  constructor(
    private readonly finance: ExecuteNodiaAiFinanceEffectUseCase,
    @Inject(NODIA_AI_BUSINESS_OPERATIONS)
    operations: readonly NodiaAiNativeOperation[],
    @Inject(NODIA_AI_RENTAL_CONFIGURATION_OPERATIONS)
    rentalOperations: readonly NodiaAiRentalConfigurationOperation[] = [],
    @Inject(NODIA_AI_RENTAL_RESERVATION_OPERATIONS)
    reservationOperations: readonly NodiaAiRentalReservationOperation[] = [],
    @Inject(NODIA_AI_RENTAL_MONEY_OPERATIONS)
    moneyOperations: readonly NodiaAiRentalMoneyOperation[] = [],
    @Inject(NODIA_AI_RENTAL_OPERATIONS)
    calendarOperations: readonly NodiaAiRentalOperation[] = [],
    @Inject(NODIA_AI_CORE_OPERATIONS)
    coreOperations: readonly NodiaAiCoreOperation[] = [],
    @Inject(RedisService) private readonly cache?: RedisService,
    @Inject(NODIA_AI_PROVIDER_OPERATIONS)
    providerOperations: readonly NodiaAiProviderOperation[] = [],
    @Inject(NODIA_AI_PREFERENCE_OPERATIONS)
    preferenceOperations: readonly NodiaAiPreferenceOperation[] = [],
  ) {
    const ports = new Map<string, NodiaAiNativeOperation>();
    for (const port of operations) {
      const identity = nodiaAiBusinessOperationIdentity(port.toolName);
      if (
        !identity ||
        identity.resourceKey !== port.resourceKey ||
        identity.operation !== port.operation ||
        ports.has(port.toolName)
      )
        throw new Error('nodia_ai:invalid_native_operation');
      ports.set(port.toolName, port);
    }
    this.ports = ports;
    const rental = new Map<string, RentalPort>();
    for (const port of [
      ...rentalOperations,
      ...reservationOperations,
      ...moneyOperations,
      ...calendarOperations,
    ]) {
      const identity = nodiaAiRentalOperationIdentity(port.toolName);
      if (
        !identity ||
        identity.resourceKey !== port.resourceKey ||
        identity.operation !== port.operation ||
        rental.has(port.toolName)
      )
        throw new Error('nodia_ai:invalid_native_operation');
      rental.set(port.toolName, port);
    }
    this.rentalPorts = rental;
    const core = new Map<string, NodiaAiCoreOperation>();
    for (const port of coreOperations) {
      const identity = nodiaAiCoreOperationIdentity(port.toolName);
      if (
        !identity ||
        identity.resourceKey !== port.resourceKey ||
        identity.operation !== port.operation ||
        core.has(port.toolName)
      )
        throw new Error('nodia_ai:invalid_native_operation');
      core.set(port.toolName, port);
    }
    this.corePorts = core;
    const providers = new Map<string, NodiaAiProviderOperation>();
    for (const port of providerOperations) {
      const identity = nodiaAiProviderOperationIdentity(port.toolName);
      if (
        !identity ||
        identity.resourceKey !== port.resourceKey ||
        identity.operation !== port.operation ||
        providers.has(port.toolName)
      )
        throw new Error('nodia_ai:invalid_native_operation');
      providers.set(port.toolName, port);
    }
    this.providerPorts = providers;
    const preferences = new Map<string, NodiaAiPreferenceOperation>();
    for (const port of preferenceOperations) {
      if (
        !/^nodia_preferences_prepare_(create|update|delete)$/.test(
          port.toolName,
        ) ||
        port.resourceKey !== 'nodia_ai_preferences' ||
        port.toolName !== `nodia_preferences_prepare_${port.operation}` ||
        preferences.has(port.toolName)
      )
        throw new Error('nodia_ai:invalid_native_operation');
      preferences.set(port.toolName, port);
    }
    this.preferencePorts = preferences;
  }
  /** Called only after the SQL callback has committed/rolled back; cache is never authority. */
  async invalidateCoreCaches(): Promise<void> {
    if (!this.cache) return;
    try {
      await this.cache.delByPattern('auth:context:*');
    } catch {
      new Logger(ExecuteNodiaAiLocalEffectUseCase.name).warn(
        'nodia_ai:core_cache_invalidation_failed',
      );
    }
  }
  execute(step: StoredProposalStep, context: ProposalPreparerContext) {
    if (nodiaAiFinanceOperationIdentity(step.toolName))
      return this.finance.execute(step, context);
    const port =
      this.ports.get(step.toolName) ??
      this.rentalPorts.get(step.toolName) ??
      this.corePorts.get(step.toolName) ??
      this.providerPorts.get(step.toolName) ??
      this.preferencePorts.get(step.toolName);
    if (!port || port.contractHash !== step.contractHash)
      throw new ConflictException('nodia_ai:catalog_changed');
    return port.executeConfirmed(step, context);
  }
}
