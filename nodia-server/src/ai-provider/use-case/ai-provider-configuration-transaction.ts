import { ForbiddenException } from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';
import {
  currentActor,
  lockAuthority,
  type ActorReference,
} from '../../authorization/authority-transaction.js';

export { hasAuthorityTransactionLocks as hasAiProviderAuthorityLock } from '../../authorization/authority-transaction-proof.js';
import { hasAuthorityTransactionLocks as hasAiProviderAuthorityLock } from '../../authorization/authority-transaction-proof.js';

export async function runAiProviderConfigurationTransaction<T>(
  source: DataSource,
  actor: ActorReference,
  work: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  const operation = async (manager: EntityManager, inherited: boolean) => {
    if (!manager.queryRunner?.isTransactionActive)
      throw new ForbiddenException('authorization:transaction_required');
    // An inherited coordinator transaction already owns the authority frontier and budget.
    if (!inherited)
      await lockAuthority(manager, false, actor.statementTimeoutMs);
    else {
      // Inspect actual backend locks rather than trusting an active/reused manager.
      // No authority/domain snapshot is read and no lock upgrade or budget reset occurs.
      if (!(await hasAiProviderAuthorityLock(manager)))
        throw new ForbiddenException(
          'authorization:authority_transaction_required',
        );
    }
    const authority = await currentActor(manager, actor);
    if (!authority.isSuperAdmin) {
      const rows: { allowed: boolean }[] = await manager.query(
        `SELECT EXISTS (SELECT 1 FROM user_roles ur
         JOIN roles r ON r.id=ur.role_id AND r.is_active=true
         JOIN role_actions ra ON ra.role_id=r.id AND ra.is_active=true
         JOIN actions a ON a.id=ra.action_id AND a.is_active=true
         WHERE ur.user_id=$1 AND ur.is_active=true AND a.key='ai:manage') AS allowed`,
        [authority.actorId],
      );
      if (rows[0]?.allowed !== true)
        throw new ForbiddenException('ai_provider:manage_required');
    }
    // Same order for all local configuration writers; serializes first/default creation too.
    await manager.query(
      'LOCK TABLE ai_provider_catalog, ai_providers IN SHARE ROW EXCLUSIVE MODE',
    );
    return work(manager);
  };
  if (actor.transaction) return operation(actor.transaction, true);
  return source.transaction((manager) => operation(manager, false));
}
