import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Arrival/departure times belong to reservations. Preserve legacy values. */
export class OptionalRentalPropertyTimes1791540000000 implements MigrationInterface {
  name = 'OptionalRentalPropertyTimes1791540000000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      'ALTER TABLE rental_properties ALTER COLUMN check_in_time DROP NOT NULL, ALTER COLUMN check_out_time DROP NOT NULL',
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    const [row]: { missing: boolean }[] = await runner.query(
      'SELECT EXISTS(SELECT 1 FROM rental_properties WHERE check_in_time IS NULL OR check_out_time IS NULL) AS missing',
    );
    if (row.missing)
      throw new Error(
        'Cannot restore required property times while accommodations without legacy times exist. Restore the previous backup; never invent arrival/departure times.',
      );
    await runner.query(
      'ALTER TABLE rental_properties ALTER COLUMN check_in_time SET NOT NULL, ALTER COLUMN check_out_time SET NOT NULL',
    );
  }
}
