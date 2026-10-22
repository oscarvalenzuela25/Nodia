// Synthetic identities and scoped persistence ports for unit tests only.
import type { EntityManager } from 'typeorm';
import type { FinanceActor } from '../authority-transaction.js';
export const actorFixture = (userId: string): FinanceActor => ({
  userId,
  sessionId: '11111111-1111-4111-8111-111111111111',
});
export function financeScopeFixture(manager: EntityManager) {
  return async <T>(
    actor: FinanceActor,
    work: (scope: {
      manager: EntityManager;
      ownerId: string;
      actorId: string;
    }) => Promise<T>,
  ) =>
    work({
      manager,
      ownerId: actor.ownerId ?? actor.userId,
      actorId: actor.userId,
    });
}
