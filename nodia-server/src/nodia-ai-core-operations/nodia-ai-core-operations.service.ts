import { ConflictException, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiCoreResource as Resource } from './types/core-operation.types.js';

const columns: Record<Resource, string> = {
  users: 'id::text,name,email,image_url,is_active',
  roles: 'id::text,key,is_active',
  actions: 'id::text,key,description,is_active',
  business_actions: 'id::text,key,has_description,is_active',
  modules: 'id::text,key,module_group_id::text,link,icon,is_active',
  module_groups: 'id::text,key,icon,is_active',
};
@Injectable()
export class NodiaAiCoreOperationsService {
  async target(
    manager: EntityManager,
    resource: Resource,
    id?: string,
    identity?: string,
  ): Promise<NodiaAiJsonObject | null> {
    if (!id && identity === undefined) return null;
    const rows: NodiaAiJsonObject[] = await manager.query(
      `SELECT ${columns[resource]} FROM ${resource} WHERE ${id ? 'id' : resource === 'users' ? 'email' : 'key'}=$1`,
      [id ?? identity],
    );
    return rows[0] ?? null;
  }
  async translations(
    manager: EntityManager,
    resource: Resource,
    id: string,
  ): Promise<NodiaAiJsonObject[]> {
    if (resource === 'users') return [];
    return manager.query(
      `SELECT source_key AS key,
      MAX(value) FILTER(WHERE locale='es') AS es, MAX(value) FILTER(WHERE locale='en') AS en
      FROM translations WHERE source_entity=$1 AND source_id=$2 AND is_active=true
      GROUP BY source_key ORDER BY source_key LIMIT 101`,
      [resource, id],
    );
  }
  private bounded(rows: NodiaAiJsonObject[], max = 1000) {
    if (rows.length > max)
      throw new ConflictException('nodia_ai:result_too_large');
    return rows;
  }
  async catalog(
    manager: EntityManager,
    resource: 'roles' | 'modules' | 'actions' | 'module_groups',
    values: readonly string[],
  ): Promise<NodiaAiJsonObject[]> {
    if (!values.length) return [];
    const rows: NodiaAiJsonObject[] = await manager.query(
      `SELECT id::text,key AS label,is_active${resource === 'modules' ? ',module_group_id::text,link' : ''} FROM ${resource}
       WHERE id=ANY($1::bigint[]) ORDER BY id LIMIT 101`,
      [values],
    );
    return this.bounded(rows, 100);
  }
  async actionKeys(
    manager: EntityManager,
    values: readonly string[],
  ): Promise<NodiaAiJsonObject[]> {
    if (!values.length) return [];
    const ids = values.filter((v) => /^[1-9][0-9]*$/.test(v));
    const keys = values.filter((v) => !/^[0-9]+$/.test(v));
    return manager.query(
      'SELECT id::text,key AS label,is_active FROM actions WHERE id=ANY($1::bigint[]) OR key=ANY($2::text[]) ORDER BY id LIMIT 101',
      [ids, keys],
    );
  }
  async associations(
    manager: EntityManager,
    resource: Resource,
    id: string,
  ): Promise<NodiaAiJsonObject> {
    const result: NodiaAiJsonObject = {};
    const associations =
      resource === 'users'
        ? [
            ['roles', 'user_roles', 'role_id'],
            ['modules', 'user_modules', 'module_id'],
          ]
        : resource === 'roles'
          ? [['actions', 'role_actions', 'action_id']]
          : [];
    for (const [catalog, pivot, fk] of associations) {
      const rows: NodiaAiJsonObject[] = await manager.query(
        `SELECT c.id::text,c.key AS label,c.is_active,p.is_active AS assignment_active FROM ${pivot} p JOIN ${catalog} c ON c.id=p.${fk} WHERE p.${resource === 'users' ? 'user_id' : 'role_id'}=$1 ORDER BY c.id LIMIT 101`,
        [id],
      );
      result[catalog] = this.bounded(rows, 100);
    }
    return result;
  }
  async affectedUsers(
    manager: EntityManager,
    resource: Resource,
    id: string,
  ): Promise<NodiaAiJsonObject[]> {
    const predicate: Record<Resource, string> = {
      users: 'u.id=$1',
      roles:
        'EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role_id=$1)',
      actions:
        'EXISTS(SELECT 1 FROM user_roles ur JOIN role_actions ra ON ra.role_id=ur.role_id WHERE ur.user_id=u.id AND ra.action_id=$1)',
      modules:
        'EXISTS(SELECT 1 FROM user_modules um WHERE um.user_id=u.id AND um.module_id=$1)',
      module_groups:
        'EXISTS(SELECT 1 FROM user_modules um JOIN modules m ON m.id=um.module_id WHERE um.user_id=u.id AND m.module_group_id=$1)',
      business_actions: 'false',
    };
    if (resource === 'business_actions') return [];
    const rows: NodiaAiJsonObject[] = await manager.query(
      `SELECT u.id::text,u.name,u.email,u.is_active FROM users u WHERE ${predicate[resource]} ORDER BY u.id LIMIT 1001`,
      [id],
    );
    return this.bounded(rows);
  }
  async groupModules(
    manager: EntityManager,
    id: string,
  ): Promise<NodiaAiJsonObject[]> {
    return this.bounded(
      await manager.query(
        'SELECT id::text,key AS label,is_active FROM modules WHERE module_group_id=$1 ORDER BY id LIMIT 1001',
        [id],
      ),
    );
  }
  async superAdmins(manager: EntityManager): Promise<NodiaAiJsonObject[]> {
    return this.bounded(
      await manager.query(
        `SELECT DISTINCT u.id::text FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.is_active=true AND ur.is_active=true AND r.is_active=true AND r.key='super_admin' ORDER BY u.id::text LIMIT 1001`,
      ),
    );
  }
}
