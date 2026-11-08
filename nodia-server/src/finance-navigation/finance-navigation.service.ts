import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { assertCoreAuthorityTransaction } from '../authorization/core-authority-transaction.js';
import {
  nextModuleGroupSortOrder,
  nextModuleSortOrder,
} from '../module-order/next-sort-order.js';

@Injectable()
export class FinanceNavigationService {
  async register(
    manager: EntityManager,
  ): Promise<{ group_id: string; module_id: string }> {
    assertCoreAuthorityTransaction(manager);
    const [existingGroup] = await manager.query<
      { id: string; sort_order: number }[]
    >('SELECT id,sort_order FROM module_groups WHERE key=$1', ['finances']);
    const groupOrder =
      existingGroup?.sort_order ?? (await nextModuleGroupSortOrder(manager));
    const groups = await manager.query<{ id: string }[]>(
      `
      INSERT INTO module_groups (key,icon,is_active,sort_order) VALUES ('finances','AccountBalanceWalletOutlined',true,$1)
      ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING id`,
      [groupOrder],
    );
    const groupId = groups[0].id;
    const [existingModule] = await manager.query<
      { id: string; module_group_id: string; sort_order: number }[]
    >('SELECT id,module_group_id,sort_order FROM modules WHERE key=$1', [
      'personal_finance',
    ]);
    const moduleOrder =
      existingModule?.module_group_id === groupId
        ? existingModule.sort_order
        : await nextModuleSortOrder(manager, groupId);
    const modules = await manager.query<{ id: string }[]>(
      `
      INSERT INTO modules (key,module_group_id,link,icon,is_active,sort_order)
      VALUES ('personal_finance',$1,'/finances-personal','AccountBalanceWalletOutlined',true,$2)
      ON CONFLICT (key) DO UPDATE SET module_group_id=EXCLUDED.module_group_id,
        sort_order=EXCLUDED.sort_order,link=EXCLUDED.link, updated_at=now() RETURNING id`,
      [groupId, moduleOrder],
    );
    const moduleId = modules[0].id;
    for (const [entity, id, es, en] of [
      ['module_groups', groupId, 'Finanzas', 'Finances'],
      ['modules', moduleId, 'Finanzas personales', 'Personal finances'],
    ]) {
      await manager.query(
        `INSERT INTO translations (source_entity,source_id,source_key,locale,value,is_active)
        VALUES ($1,$2,'key','es',$3,true),($1,$2,'key','en',$4,true)
        ON CONFLICT (source_entity,source_id,source_key,locale)
        DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
        [entity, id, es, en],
      );
    }
    return { group_id: groupId, module_id: moduleId };
  }
}
