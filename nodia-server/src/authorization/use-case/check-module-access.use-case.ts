import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { canonicalModuleRoute, MODULE_ROUTE_MIGRATION } from '../canonical-module-route.js';

/** Current database authority; navigation/JWT role snapshots are not grants. */
@Injectable()
export class CheckModuleAccessUseCase {
  constructor(private readonly dataSource: DataSource) {}

  async execute(
    userId: string,
    moduleRoutes: readonly string[],
    manager?: EntityManager,
    match: 'all' | 'any' = 'all',
  ): Promise<void> {
    if (
      !/^[1-9][0-9]{0,18}$/.test(userId) ||
      BigInt(userId) > 9223372036854775807n
    )
      throw new UnauthorizedException('auth:session_expired');
    if (
      moduleRoutes.some(
        (route) => typeof route !== 'string' || !route.trim().startsWith('/'),
      )
    )
      throw new ForbiddenException('core:module_access_required');
    const routes = [
      ...new Set(
        moduleRoutes.map((route) =>
          canonicalModuleRoute(`/${route
            .trim()
            .split(/[?#]/, 1)[0]
            .replace(/^\/+|\/+$/g, '')}`.toLowerCase()),
        ),
      ),
    ];
    const rows: { actor_active: boolean; allowed: boolean }[] = await (
      manager ?? this.dataSource
    ).query(
      `WITH actor AS (
         SELECT u.id,
           EXISTS (SELECT 1 FROM user_roles ur
             JOIN roles r ON r.id=ur.role_id AND r.is_active=true
             WHERE ur.user_id=u.id AND ur.is_active=true AND r.key='super_admin') AS is_super_admin
         FROM users u WHERE u.id=$1 AND u.is_active=true
       ), required_routes AS (SELECT unnest($2::text[]) AS route),
       canonical_modules AS (
         SELECT m.id,coalesce($4::jsonb->>resolved.route,resolved.route) AS route
         FROM modules m JOIN module_groups mg ON mg.id=m.module_group_id AND mg.is_active=true
         CROSS JOIN LATERAL (SELECT '/' || lower(regexp_replace(split_part(split_part(btrim(
           coalesce(nullif(btrim(m.link), ''), CASE lower(m.key)
             WHEN 'users' THEN '/users' WHEN 'usuarios' THEN '/users'
             WHEN 'roles' THEN '/roles'
             WHEN 'actions' THEN '/actions' WHEN 'acciones' THEN '/actions'
             WHEN 'modules' THEN '/modules' WHEN 'modulos' THEN '/modules'
             WHEN 'nodia_teacher' THEN '/nodia-teacher'
             WHEN 'business' THEN '/business' WHEN 'businesses' THEN '/business' WHEN 'negocios' THEN '/business'
             WHEN 'ai-providers' THEN '/ai-providers' WHEN 'ai_providers' THEN '/ai-providers'
             WHEN 'ai-provider' THEN '/ai-providers' WHEN 'ai_provider' THEN '/ai-providers'
             WHEN 'proveedores_ia' THEN '/ai-providers' WHEN 'proveedores-ia' THEN '/ai-providers'
             ELSE '/' END)
         ), '?', 1), '#', 1), '^/+|/+$', '', 'g')) AS route) resolved
         WHERE m.is_active=true
       ),
       permitted_routes AS (
         SELECT requested.route FROM required_routes requested, actor WHERE (
           SELECT count(*)=1 AND coalesce(bool_or(EXISTS (
             SELECT 1 FROM user_modules um
             WHERE um.user_id=actor.id AND um.module_id=m.id AND um.is_active=true
           )),false)
           FROM canonical_modules m WHERE m.route=requested.route
         )
       )
       SELECT EXISTS (SELECT 1 FROM actor) AS actor_active,
         EXISTS (SELECT 1 FROM actor WHERE is_super_admin OR CASE WHEN $3='any'
           THEN EXISTS (SELECT 1 FROM permitted_routes)
           ELSE (SELECT count(*) FROM permitted_routes)=(SELECT count(*) FROM required_routes)
         END) AS allowed`,
      [userId, routes, match, Object.fromEntries(MODULE_ROUTE_MIGRATION)],
    );
    if (rows[0]?.actor_active !== true)
      throw new UnauthorizedException('auth:session_expired');
    if (rows[0]?.allowed !== true)
      throw new ForbiddenException('core:module_access_required');
  }
}
