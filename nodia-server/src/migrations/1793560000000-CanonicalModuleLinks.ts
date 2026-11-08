import type { MigrationInterface, QueryRunner } from 'typeorm';

// Frozen explicit mapping: never import a mutable application's route catalogue.
const mapping = [
  ['/tools/nodia-ai', '/nodia-ai'], ['/tools/reservations', '/reservations'],
  ['/tools/finances-personal', '/finances-personal'], ['/tools/business', '/business'],
  ...['users', 'roles', 'actions', 'modules', 'ai-providers'].flatMap(resource =>
    [[`/settings/${resource}`, `/${resource}`], [`/general-settings/${resource}`, `/${resource}`]]),
];

export class CanonicalModuleLinks1793560000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query("SET LOCAL lock_timeout='2s'");
    if (!runner.isTransactionActive) throw Error('canonical_module_links_transaction_required');
    // Same authority frontier/order as current Core writers; no concurrent reassignment.
    await runner.query('LOCK TABLE actions, auth_sessions, module_groups, modules, role_actions, roles, user_modules, user_roles, users IN SHARE ROW EXCLUSIVE MODE');
    await runner.query(`CREATE TABLE IF NOT EXISTS module_link_migration_179356 (
      module_id bigint PRIMARY KEY,
      original_key varchar(255) NOT NULL,
      original_link varchar(255) NOT NULL, canonical_link varchar(255) NOT NULL,
      original_updated_at timestamp NOT NULL, migrated_at timestamptz NOT NULL DEFAULT now())`);
    // Reject NEW collisions between distinct links. A duplicate exact link already
    // present remains ambiguous/denied; merging its IDs or assignments is not a migration.
    for (const destination of new Set(mapping.map(pair => pair[1]))) {
      const sources = mapping.filter(pair => pair[1] === destination).map(pair => pair[0]);
      const rows: { link: string }[] = await runner.query(
        'SELECT DISTINCT link FROM modules WHERE link=ANY($1::text[])', [[destination, ...sources]],
      );
      if (rows.length > 1) throw Error('canonical_module_links_collision:' + destination);
    }
    for (const [source, destination] of mapping) {
      const conflicts: unknown[] = await runner.query(`SELECT m.id FROM modules m
        JOIN module_link_migration_179356 b ON b.module_id=m.id
        WHERE m.link=$1 AND (b.original_link<>$1 OR b.canonical_link<>$2 OR b.original_key<>m.key)`, [source, destination]);
      if (conflicts.length) throw Error('canonical_module_links_ledger_conflict');
      await runner.query(`INSERT INTO module_link_migration_179356(module_id,original_key,original_link,canonical_link,original_updated_at)
        SELECT id,key,link,$2,updated_at FROM modules WHERE link=$1 ON CONFLICT(module_id) DO NOTHING`, [source, destination]);
      await runner.query(`UPDATE modules m SET link=$2 WHERE m.link=$1 AND EXISTS(
        SELECT 1 FROM module_link_migration_179356 b WHERE b.module_id=m.id AND b.original_link=$1 AND b.canonical_link=$2)`, [source, destination]);
    }
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query("SET LOCAL lock_timeout='2s'");
    if (!runner.isTransactionActive) throw Error('canonical_module_links_transaction_required');
    await runner.query('LOCK TABLE actions, auth_sessions, module_groups, modules, role_actions, roles, user_modules, user_roles, users IN SHARE ROW EXCLUSIVE MODE');
    if (!await runner.hasTable('module_link_migration_179356')) return;
    const conflicts: unknown[] = await runner.query(`SELECT b.module_id FROM module_link_migration_179356 b
      LEFT JOIN modules m ON m.id=b.module_id WHERE m.id IS NULL OR m.link<>b.canonical_link OR m.key<>b.original_key
        OR EXISTS(SELECT 1 FROM modules other WHERE other.id<>b.module_id AND other.link=b.original_link)`);
    if (conflicts.length) throw Error('canonical_module_links_rollback_conflict');
    await runner.query(`UPDATE modules m SET link=b.original_link FROM module_link_migration_179356 b WHERE m.id=b.module_id`);
    await runner.query('DROP TABLE module_link_migration_179356');
  }
}
