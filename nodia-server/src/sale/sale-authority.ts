import { ForbiddenException } from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';
import { assertBusinessesAccess } from '../business-access/business-access.js';
import {
  lockAuthority,
  type ActorReference,
} from '../authorization/authority-transaction.js';
import type { CheckModuleAccessUseCase } from '../authorization/use-case/check-module-access.use-case.js';
import { saleUuid } from './policies/sale-policy.js';

export async function runSaleScope<T>(
  source: DataSource,
  modules: CheckModuleAccessUseCase,
  businessId: string,
  actor: ActorReference,
  work: (manager: EntityManager) => Promise<T>,
  existingManager?: EntityManager,
): Promise<T> {
  saleUuid(businessId);
  const operation = async (manager: EntityManager) => {
    if (!manager.queryRunner?.isTransactionActive)
      throw new ForbiddenException('authorization:transaction_required');
    // Same order as native effects and authority writers; no domain read before authority is locked.
    await lockAuthority(manager, false, actor.statementTimeoutMs);
    await modules.execute(actor.userId, ['/business'], manager);
    await assertBusinessesAccess(manager, actor, [businessId], { lock: true });
    return work(manager);
  };
  const manager = existingManager ?? actor.transaction;
  return manager
    ? operation(manager)
    : source.transaction('READ COMMITTED', operation);
}
