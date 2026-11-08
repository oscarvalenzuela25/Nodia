import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { assertCoreAuthorityTransaction } from '../authorization/core-authority-transaction.js';
import {
  nextModuleGroupSortOrder,
  nextModuleSortOrder,
} from '../module-order/next-sort-order.js';
@Injectable()
export class RentalNavigationService {
  async register(
    manager: EntityManager,
  ): Promise<{ group_id: string; module_id: string }> {
    assertCoreAuthorityTransaction(manager);
    const [existingGroup] = await manager.query<
      { id: string; sort_order: number }[]
    >('SELECT id,sort_order FROM module_groups WHERE key=$1', ['tools']);
    const groupOrder =
      existingGroup?.sort_order ?? (await nextModuleGroupSortOrder(manager));
    const [group]: { id: string }[] = await manager.query(
      "INSERT INTO module_groups(key,icon,is_active,sort_order) VALUES ('tools','BuildOutlined',true,$1) ON CONFLICT(key) DO UPDATE SET key=EXCLUDED.key RETURNING id",
      [groupOrder],
    );
    const [existingModule] = await manager.query<
      { id: string; module_group_id: string; sort_order: number }[]
    >('SELECT id,module_group_id,sort_order FROM modules WHERE key=$1', [
      'rental_reservations',
    ]);
    const moduleOrder =
      existingModule?.module_group_id === group.id
        ? existingModule.sort_order
        : await nextModuleSortOrder(manager, group.id);
    const [module]: { id: string }[] = await manager.query(
      "INSERT INTO modules(key,module_group_id,link,icon,is_active,sort_order) VALUES ('rental_reservations',$1,'/reservations','HolidayVillageOutlined',true,$2) ON CONFLICT(key) DO UPDATE SET module_group_id=EXCLUDED.module_group_id,sort_order=EXCLUDED.sort_order,link=EXCLUDED.link,updated_at=now() RETURNING id",
      [group.id, moduleOrder],
    );
    for (const [entity, id, es, en] of [
      ['module_groups', group.id, 'Tools', 'Tools'],
      ['modules', module.id, 'Reservas de alojamiento', 'Rental reservations'],
    ]) {
      await manager.query(
        "INSERT INTO translations(source_entity,source_id,source_key,locale,value,is_active) VALUES ($1,$2,'key','es',$3,true),($1,$2,'key','en',$4,true) ON CONFLICT(source_entity,source_id,source_key,locale) DO NOTHING",
        [entity, id, es, en],
      );
    }
    return { group_id: group.id, module_id: module.id };
  }
}
