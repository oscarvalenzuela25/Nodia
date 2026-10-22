import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Catalog only; preserves existing inactivity/translations and creates no assignments. */
export class RegisterNodiaAiNavigation1792100000000 implements MigrationInterface {
  name = 'RegisterNodiaAiNavigation1792100000000';

  async up(runner: QueryRunner): Promise<void> {
    // Frozen migration: do not import a live service whose later edits change migration history.
    const [group]: { id: string }[] = await runner.query(
      `INSERT INTO module_groups(key,icon,is_active) VALUES ('tools','BuildOutlined',true)
       ON CONFLICT(key) DO UPDATE SET key=EXCLUDED.key RETURNING id`,
    );
    const [module]: { id: string }[] = await runner.query(
      `INSERT INTO modules(key,module_group_id,link,icon,is_active)
       VALUES ('nodia_ai',$1,'/tools/nodia-ai','AutoAwesomeOutlined',true)
       ON CONFLICT(key) DO UPDATE SET module_group_id=EXCLUDED.module_group_id,
         link=EXCLUDED.link,updated_at=now() RETURNING id`,
      [group.id],
    );
    for (const [entity, id, es, en] of [
      ['module_groups', group.id, 'Herramientas', 'Tools'],
      ['modules', module.id, 'NodiaAI', 'NodiaAI'],
    ])
      await runner.query(
        `INSERT INTO translations(source_entity,source_id,source_key,locale,value,is_active)
       VALUES ($1,$2,'key','es',$3,true),($1,$2,'key','en',$4,true)
       ON CONFLICT(source_entity,source_id,source_key,locale) DO NOTHING`,
        [entity, id, es, en],
      );
  }

  async down(): Promise<void> {
    // Catalog identities/explicit assignments belong to operators after installation.
    // Do not delete shared groups, user assignments or edited translations on rollback.
  }
}
