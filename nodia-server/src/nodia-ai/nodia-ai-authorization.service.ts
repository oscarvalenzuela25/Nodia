import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import type {
  NodiaAiActorReference,
  NodiaAiAuthorizationSnapshot,
} from './types/nodia-ai-authorization.types.js';

@Injectable()
export class NodiaAiAuthorizationService {
  constructor(private readonly dataSource: DataSource) {}

  async loadCurrentActor(
    identity: NodiaAiActorReference,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<NodiaAiAuthorizationSnapshot | null> {
    // One PostgreSQL statement / snapshot, no Redis context, client roles or N+1 queries.
    const rows: NodiaAiAuthorizationSnapshot[] = await manager.query(
      `SELECT u.id::text AS "actorId", s.public_id::text AS "sessionId",
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id
          WHERE ur.user_id=u.id AND ur.is_active=true AND r.is_active=true
          AND r.key='super_admin') AS "isSuperAdmin",
        COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id',m.id::text,'key',m.key,'route',m.link,'assigned',EXISTS (
            SELECT 1 FROM user_modules um WHERE um.user_id=u.id
            AND um.module_id=m.id AND um.is_active=true)) ORDER BY m.id)
          FROM modules m JOIN module_groups g ON g.id=m.module_group_id
          WHERE m.is_active=true AND g.is_active=true),'[]'::jsonb) AS modules,
        COALESCE((SELECT jsonb_agg(DISTINCT a.key) FROM user_roles ur
          JOIN roles r ON r.id=ur.role_id AND r.is_active=true
          JOIN role_actions ra ON ra.role_id=r.id AND ra.is_active=true
          JOIN actions a ON a.id=ra.action_id AND a.is_active=true
          WHERE ur.user_id=u.id AND ur.is_active=true),'[]'::jsonb) AS "actionKeys"
       FROM users u JOIN auth_sessions s ON s.user_id=u.id
       WHERE u.id=$1 AND u.is_active=true AND s.public_id=$2
         AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()`,
      [identity.userId, identity.sessionId],
    );
    return rows[0] ?? null;
  }
}
