import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Append/move writers must be adopted before resuming writes after this migration. */
export class AddModuleSortOrder1793200000000 implements MigrationInterface {
  name = 'AddModuleSortOrder1793200000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE module_groups, modules IN ACCESS EXCLUSIVE MODE;
      ALTER TABLE module_groups ADD COLUMN sort_order integer;
      ALTER TABLE modules ADD COLUMN sort_order integer;

      WITH ranked AS (
        SELECT id, (row_number() OVER (
          ORDER BY CASE
            WHEN regexp_replace(lower(key), '[-_]', '', 'g') LIKE '%business%'
              OR regexp_replace(lower(key), '[-_]', '', 'g') LIKE '%negocio%' THEN 1
            WHEN regexp_replace(lower(key), '[-_]', '', 'g') LIKE '%setting%'
              OR regexp_replace(lower(key), '[-_]', '', 'g') LIKE '%ajuste%'
              OR regexp_replace(lower(key), '[-_]', '', 'g') LIKE '%admin%' THEN 99
            ELSE 50
          END, id ASC
        ) - 1)::integer AS position
        FROM module_groups
      )
      UPDATE module_groups AS target SET sort_order=ranked.position
        FROM ranked WHERE target.id=ranked.id;

      WITH ranked AS (
        SELECT id, (row_number() OVER (
          PARTITION BY module_group_id ORDER BY id ASC
        ) - 1)::integer AS position
        FROM modules
      )
      UPDATE modules AS target SET sort_order=ranked.position
        FROM ranked WHERE target.id=ranked.id;

      ALTER TABLE module_groups
        ALTER COLUMN sort_order SET NOT NULL,
        ADD CONSTRAINT ck_module_groups_sort_order_nonnegative CHECK (sort_order >= 0),
        ADD CONSTRAINT uq_module_groups_sort_order UNIQUE (sort_order)
          DEFERRABLE INITIALLY IMMEDIATE;
      ALTER TABLE modules
        ALTER COLUMN sort_order SET NOT NULL,
        ADD CONSTRAINT ck_modules_sort_order_nonnegative CHECK (sort_order >= 0),
        ADD CONSTRAINT uq_modules_group_sort_order UNIQUE (module_group_id, sort_order)
          DEFERRABLE INITIALLY IMMEDIATE;
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    // Native records survive rollback; the ordering feature itself is intentionally removed.
    await runner.query(`
      LOCK TABLE module_groups, modules IN ACCESS EXCLUSIVE MODE;
      ALTER TABLE modules
        DROP CONSTRAINT uq_modules_group_sort_order,
        DROP CONSTRAINT ck_modules_sort_order_nonnegative,
        DROP COLUMN sort_order;
      ALTER TABLE module_groups
        DROP CONSTRAINT uq_module_groups_sort_order,
        DROP CONSTRAINT ck_module_groups_sort_order_nonnegative,
        DROP COLUMN sort_order;
    `);
  }
}
