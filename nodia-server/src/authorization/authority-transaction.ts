import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';
import type { AuthPrincipal } from '../auth/types/auth.types.js';

export interface ActorReference {
  userId: string;
  sessionId: string;
  /** Internal only; never a DTO or persisted identity. */ transaction?: EntityManager;
  /** Internal consumer ceiling; never an identity claim, DTO or persisted permission. */
  statementTimeoutMs?: number;
}
export interface FinanceActor extends ActorReference {
  ownerId?: string;
}
export interface CurrentActor {
  actorId: string;
  sessionId: string;
  isSuperAdmin: boolean;
}
const tables =
  'actions, auth_sessions, module_groups, modules, role_actions, roles, user_modules, user_roles, users';

/** Utility LOCK precedes the first MVCC query, including REPEATABLE READ snapshots. */
export async function lockAuthority(
  manager: EntityManager,
  write = false,
  statementTimeoutMs?: number,
): Promise<void> {
  if (
    statementTimeoutMs !== undefined &&
    (!Number.isSafeInteger(statementTimeoutMs) || statementTimeoutMs < 1)
  )
    throw new ForbiddenException('authorization:statement_timeout');
  await manager.query("SET LOCAL lock_timeout = '2s'");
  await manager.query(
    statementTimeoutMs === undefined
      ? "SET LOCAL statement_timeout = '5s'"
      : `SET LOCAL statement_timeout = '${Math.min(5000, statementTimeoutMs)}ms'`,
  );
  await manager.query(
    `LOCK TABLE ${tables} IN ${write ? 'SHARE ROW EXCLUSIVE' : 'SHARE'} MODE`,
  );
}

export function actorReference(principal: AuthPrincipal): ActorReference {
  return { userId: principal.user.id, sessionId: principal.sessionId };
}

export async function currentActor(
  manager: EntityManager,
  actor: ActorReference,
): Promise<CurrentActor> {
  if (
    !actor ||
    typeof actor.userId !== 'string' ||
    !/^[1-9][0-9]{0,18}$/.test(actor.userId) ||
    BigInt(actor.userId) > 9223372036854775807n ||
    typeof actor.sessionId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      actor.sessionId,
    )
  )
    throw new UnauthorizedException('auth:session_expired');
  const rows: CurrentActor[] = await manager.query(
    `SELECT u.id::text AS "actorId",s.public_id::text AS "sessionId",
      EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id
        WHERE ur.user_id=u.id AND ur.is_active=true AND r.is_active=true AND r.key='super_admin') AS "isSuperAdmin"
     FROM users u JOIN auth_sessions s ON s.user_id=u.id
     WHERE u.id=$1 AND u.is_active=true AND s.public_id=$2 AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()`,
    [actor.userId, actor.sessionId],
  );
  if (!rows[0]) throw new UnauthorizedException('auth:session_expired');
  return rows[0];
}

export async function runFinanceScope<T>(
  source: DataSource,
  actor: FinanceActor,
  work: (scope: {
    manager: EntityManager;
    ownerId: string;
    actorId: string;
  }) => Promise<T>,
  isolation: 'READ COMMITTED' | 'REPEATABLE READ' = 'READ COMMITTED',
): Promise<T> {
  const operation = async (manager: EntityManager) => {
    await lockAuthority(manager, false, actor.statementTimeoutMs);
    const authority = await currentActor(manager, actor);
    const ownerId = actor.ownerId ?? authority.actorId;
    if (
      typeof ownerId !== 'string' ||
      !/^[1-9][0-9]{0,18}$/.test(ownerId) ||
      BigInt(ownerId) > 9223372036854775807n
    )
      throw new BadRequestException('finance:invalid_positive_integer');
    if (ownerId !== authority.actorId && !authority.isSuperAdmin)
      throw new ForbiddenException('finance:scope_denied');
    if (ownerId !== authority.actorId) {
      const [owner]: { exists: boolean }[] = await manager.query(
        'SELECT EXISTS(SELECT 1 FROM users WHERE id=$1) AS exists',
        [ownerId],
      );
      if (!owner?.exists)
        throw new NotFoundException('finance:owner_not_found');
    }
    return work({ manager, ownerId, actorId: authority.actorId });
  };
  if (actor.transaction) {
    if (!actor.transaction.queryRunner?.isTransactionActive)
      throw new ForbiddenException('authorization:transaction_required');
    if (isolation === 'REPEATABLE READ') {
      const [current]: { transaction_isolation: string }[] =
        await actor.transaction.query('SHOW transaction_isolation');
      if (current?.transaction_isolation !== 'repeatable read')
        throw new ForbiddenException('authorization:transaction_isolation');
    }
    return operation(actor.transaction);
  }
  return source.transaction(isolation, operation);
}
