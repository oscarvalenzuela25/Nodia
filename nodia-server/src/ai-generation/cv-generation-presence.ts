import type { EntityManager } from 'typeorm';

/** The shared runtime also reads snapshots created before the CV migrations. */
export async function hasCvGenerationStore(
  manager: EntityManager,
): Promise<boolean> {
  const [row]: { present: boolean }[] = await manager.query(
    "SELECT to_regclass('public.nodia_cv_generations') IS NOT NULL AS present",
  );
  return row?.present === true;
}

export async function countQueuedCvGenerations(
  manager: EntityManager,
): Promise<number> {
  if (!(await hasCvGenerationStore(manager))) return 0;

  const [row]: { count: number }[] = await manager.query(
    `SELECT count(*)::int AS count FROM nodia_cv_generations
      WHERE state='queued' AND queue_expires_at>clock_timestamp()`,
  );
  return row.count;
}
