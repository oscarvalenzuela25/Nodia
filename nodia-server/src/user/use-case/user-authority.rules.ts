import { ForbiddenException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

export async function activeSuperAdminCount(
  manager: EntityManager,
): Promise<number> {
  const rows: { count: number }[] = await manager.query(
    `SELECT count(DISTINCT u.id)::int AS count FROM users u
     JOIN user_roles ur ON ur.user_id=u.id AND ur.is_active=true
     JOIN roles r ON r.id=ur.role_id AND r.is_active=true AND r.key='super_admin'
     WHERE u.is_active=true`,
  );
  return rows[0].count;
}

export async function preserveSuperAdmin(
  manager: EntityManager,
  previous: number,
): Promise<void> {
  if (previous > 0 && (await activeSuperAdminCount(manager)) === 0)
    throw new ForbiddenException('users:last_super_admin');
}
