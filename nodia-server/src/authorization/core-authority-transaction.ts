import { ForbiddenException } from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';
import {
  currentActor,
  lockAuthority,
  type ActorReference,
} from './authority-transaction.js';

// Process-local proof of the exclusive frontier, never supplied by a DTO or actor.
const exclusiveManagers = new WeakSet<EntityManager>();

/** Root-only frontier: call before any authority or domain SELECT. */
async function lockCoreAuthority(
  manager: EntityManager,
  statementTimeoutMs?: number,
): Promise<void> {
  await lockAuthority(manager, true, statementTimeoutMs);
  exclusiveManagers.add(manager);
}

/** Scoped proof cannot survive commit/rollback or a reused QueryRunner manager. */
export async function withCoreAuthorityLock<T>(
  manager: EntityManager,
  statementTimeoutMs: number | undefined,
  work: () => Promise<T>,
): Promise<T> {
  if (exclusiveManagers.has(manager))
    throw new ForbiddenException(
      'authorization:exclusive_transaction_required',
    );
  await lockCoreAuthority(manager, statementTimeoutMs);
  try {
    return await work();
  } finally {
    exclusiveManagers.delete(manager);
  }
}

export function assertCoreAuthorityTransaction(manager: EntityManager): void {
  if (!isCoreAuthorityTransaction(manager))
    throw new ForbiddenException(
      'authorization:exclusive_transaction_required',
    );
}

export function isCoreAuthorityTransaction(manager: EntityManager): boolean {
  return (
    manager.queryRunner?.isTransactionActive === true &&
    exclusiveManagers.has(manager)
  );
}

/** A native Core writer inherits the coordinator's exclusive transaction without resetting its budget. */
export async function runCoreAuthorityTransaction<T>(
  source: DataSource,
  actor: ActorReference,
  work: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  if (actor.transaction) {
    assertCoreAuthorityTransaction(actor.transaction);
    await currentActor(actor.transaction, actor);
    return work(actor.transaction);
  }
  return source.transaction((manager) =>
    withCoreAuthorityLock(manager, actor.statementTimeoutMs, async () => {
      await currentActor(manager, actor);
      return work(manager);
    }),
  );
}
