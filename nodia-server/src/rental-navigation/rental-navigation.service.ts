import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
@Injectable()
export class RentalNavigationService {
  async register(
    manager: EntityManager,
  ): Promise<{ group_id: string; module_id: string }> {
    const [group]: { id: string }[] = await manager.query(
      "INSERT INTO module_groups(key,icon,is_active) VALUES ('tools','BuildOutlined',true) ON CONFLICT(key) DO UPDATE SET key=EXCLUDED.key RETURNING id",
    );
    const [module]: { id: string }[] = await manager.query(
      "INSERT INTO modules(key,module_group_id,link,icon,is_active) VALUES ('rental_reservations',$1,'/tools/reservations','HolidayVillageOutlined',true) ON CONFLICT(key) DO UPDATE SET module_group_id=EXCLUDED.module_group_id,link=EXCLUDED.link,updated_at=now() RETURNING id",
      [group.id],
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
