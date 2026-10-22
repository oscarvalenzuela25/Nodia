import type { EntityManager } from 'typeorm';

/** Authority barrier -> this gate -> conversation -> job. Never held across external I/O. */
export async function lockNodiaAiQueue(manager: EntityManager): Promise<void> {
  await manager.query(
    "SELECT pg_advisory_xact_lock(hashtext('nodia-ai:foreground-admission'))",
  );
}
