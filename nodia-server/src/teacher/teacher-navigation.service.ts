import { ConflictException, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { assertCoreAuthorityTransaction } from '../authorization/core-authority-transaction.js';
import { nextModuleGroupSortOrder, nextModuleSortOrder } from '../module-order/next-sort-order.js';

export interface TeacherNavigationRegistration {
  group_id: string;
  module_id: string;
  module_key: string;
  created: boolean;
}

/** Explicit installation only. The module maintainer remains the ordinary setup path. */
@Injectable()
export class TeacherNavigationService {
  async register(manager: EntityManager): Promise<TeacherNavigationRegistration> {
    assertCoreAuthorityTransaction(manager);
    const existing: { id: string; key: string; link: string; module_group_id: string }[] = await manager.query(
      'SELECT id::text,key,link,module_group_id::text FROM modules WHERE key=$1 OR link=$2 ORDER BY id',
      ['nodia_teacher', '/nodia-teacher'],
    );
    if (existing.length > 1) throw new ConflictException('teacher:navigation_ambiguous');
    if (existing.length === 1) {
      if (existing[0].link !== '/nodia-teacher') throw new ConflictException('teacher:navigation_link_conflict');
      // Preserve a module created/moved/renamed by the user, including inactive state.
      return { group_id: existing[0].module_group_id, module_id: existing[0].id,
        module_key: existing[0].key, created: false };
    }
    let [group]: { id: string }[] = await manager.query('SELECT id::text FROM module_groups WHERE key=$1', ['studies']);
    const createdGroup = !group;
    if (!group) {
      [group] = await manager.query(`INSERT INTO module_groups(key,icon,is_active,sort_order)
        VALUES('studies','PsychologyOutlined',true,$1) RETURNING id::text`, [await nextModuleGroupSortOrder(manager)]);
    }
    const [module]: { id: string }[] = await manager.query(`INSERT INTO modules(key,module_group_id,link,icon,is_active,sort_order)
      VALUES('nodia_teacher',$1,'/nodia-teacher','PsychologyOutlined',true,$2) RETURNING id::text`,
    [group.id, await nextModuleSortOrder(manager, group.id)]);
    const labels = [
      ...(createdGroup ? [{ entity: 'module_groups', id: group.id, es: 'Estudios', en: 'Studies' }] : []),
      { entity: 'modules', id: module.id, es: 'Nodia Teacher', en: 'Nodia Teacher' },
    ];
    for (const label of labels) await manager.query(`INSERT INTO translations(source_entity,source_id,source_key,locale,value,is_active)
      VALUES($1,$2,'key','es',$3,true),($1,$2,'key','en',$4,true)
      ON CONFLICT(source_entity,source_id,source_key,locale) DO NOTHING`, [label.entity, label.id, label.es, label.en]);
    return { group_id: group.id, module_id: module.id, module_key: 'nodia_teacher', created: true };
  }
}
