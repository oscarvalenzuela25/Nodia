import type { EntityManager } from 'typeorm';

export async function hasAuthorityTransactionLocks(
  manager: EntityManager,
): Promise<boolean> {
  if (!manager.queryRunner?.isTransactionActive) return false;
  const [proof]: { authority_locks: number }[] = await manager.query(`
        SELECT count(DISTINCT c.oid)::int AS authority_locks FROM pg_locks l
        JOIN pg_class c ON c.oid=l.relation
        WHERE l.pid=pg_backend_pid() AND l.granted=true
          AND l.mode IN ('ShareLock','ShareRowExclusiveLock')
          AND c.oid=ANY(ARRAY['actions'::regclass,'auth_sessions'::regclass,
            'module_groups'::regclass,'modules'::regclass,'role_actions'::regclass,
            'roles'::regclass,'user_modules'::regclass,'user_roles'::regclass,'users'::regclass])
      `);
  return proof?.authority_locks === 9;
}
