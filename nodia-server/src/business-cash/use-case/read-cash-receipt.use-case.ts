import { Injectable } from '@nestjs/common';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { CashBusinessScope } from '../cash-business-scope.js';
import { CashMutationRequestsService } from '../cash-mutation-requests.service.js';
import { normalizeCashUuid } from '../policies/cash-category.policy.js';
import type { CashMutationReceipt } from '../types/cash.types.js';

@Injectable()
export class ReadCashReceiptUseCase {
  constructor(
    private readonly scope: CashBusinessScope,
    private readonly requests: CashMutationRequestsService,
  ) {}

  execute(
    businessId: string,
    key: string,
    actor: ActorReference,
  ): Promise<CashMutationReceipt> {
    const identity = {
      businessId: normalizeCashUuid(businessId),
      requestKey: normalizeCashUuid(key),
      actorId: actor.userId,
    };
    return this.scope.run(identity.businessId, actor, (manager) =>
      this.requests.read(manager, identity),
    );
  }
}
