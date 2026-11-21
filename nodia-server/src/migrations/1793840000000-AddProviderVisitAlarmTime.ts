import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProviderVisitAlarmTime1793840000000
  implements MigrationInterface
{
  name = 'AddProviderVisitAlarmTime1793840000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE providers
        ADD COLUMN visit_alarm_time varchar(5),
        ADD CONSTRAINT chk_providers_visit_alarm_time
          CHECK (visit_alarm_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE providers DROP COLUMN visit_alarm_time');
  }
}
