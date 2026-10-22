import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource, IsNull, type EntityManager } from 'typeorm';
import {
  currentActor,
  lockAuthority,
  type ActorReference,
} from '../../authorization/authority-transaction.js';
import { hasAuthorityTransactionLocks } from '../../authorization/authority-transaction-proof.js';
import { AuthSession } from '../entities/auth-session.entity.js';

/** Human-confirmed revocation of exactly the authenticated Nodia session. No refresh token is transported through chat. */
@Injectable()
export class RevokeOwnAuthSessionUseCase {
  constructor(private readonly source: DataSource) {}

  async execute(actor: ActorReference): Promise<void> {
    const work = async (manager: EntityManager, inherited: boolean) => {
      if (!manager.queryRunner?.isTransactionActive)
        throw new ForbiddenException('authorization:transaction_required');
      if (inherited) {
        if (!(await hasAuthorityTransactionLocks(manager)))
          throw new ForbiddenException(
            'authorization:authority_transaction_required',
          );
      } else await lockAuthority(manager, true, actor.statementTimeoutMs);
      await currentActor(manager, actor);
      await manager.getRepository(AuthSession).update(
        {
          public_id: actor.sessionId,
          user_id: actor.userId,
          revoked_at: IsNull(),
        },
        { revoked_at: new Date() },
      );
    };
    if (actor.transaction) return work(actor.transaction, true);
    return this.source.transaction((manager) => work(manager, false));
  }
}
