import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIconToModulesAndModuleGroups1789257700000
  implements MigrationInterface
{
  name = 'AddIconToModulesAndModuleGroups1789257700000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE modules ADD COLUMN IF NOT EXISTS icon varchar(255)',
    );
    await queryRunner.query(
      'ALTER TABLE module_groups ADD COLUMN IF NOT EXISTS icon varchar(255)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE modules DROP COLUMN IF EXISTS icon');
    await queryRunner.query(
      'ALTER TABLE module_groups DROP COLUMN IF EXISTS icon',
    );
  }
}
