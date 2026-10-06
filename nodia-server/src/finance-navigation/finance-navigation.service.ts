import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

@Injectable()
export class FinanceNavigationService {
  async register(
    manager: EntityManager,
  ): Promise<{ group_id: string; module_id: string }> {
    const groups = await manager.query<{ id: string }[]>(`
      INSERT INTO module_groups (key,icon,is_active) VALUES ('finances','AccountBalanceWalletOutlined',true)
      ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING id`);
    const groupId = groups[0].id;
    const modules = await manager.query<{ id: string }[]>(
      `
      INSERT INTO modules (key,module_group_id,link,icon,is_active)
      VALUES ('personal_finance',$1,'/finances/personal','AccountBalanceWalletOutlined',true)
      ON CONFLICT (key) DO UPDATE SET module_group_id=EXCLUDED.module_group_id,
        link=EXCLUDED.link, updated_at=now() RETURNING id`,
      [groupId],
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
