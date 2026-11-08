import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDirectSaleCheckout1793420000000 implements MigrationInterface {
  name = 'AddDirectSaleCheckout1793420000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE sale_mutation_requests DROP CONSTRAINT sale_mutation_requests_operation_check;
      ALTER TABLE sale_mutation_requests ADD CONSTRAINT sale_mutation_requests_operation_check
        CHECK(operation IN ('create','checkout','update','complete','cancel','discard'));
      ALTER TABLE sale_events DROP CONSTRAINT sale_events_event_type_check;
      ALTER TABLE sale_events ADD CONSTRAINT sale_events_event_type_check
        CHECK(event_type IN ('create','checkout','update','complete','cancel','discard'));
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      'LOCK TABLE sale_mutation_requests,sale_events IN ACCESS EXCLUSIVE MODE',
    );
    const [row]: { present: boolean }[] = await runner.query(`SELECT
      EXISTS(SELECT 1 FROM sale_mutation_requests WHERE operation='checkout') OR
      EXISTS(SELECT 1 FROM sale_events WHERE event_type='checkout') AS present`);
    if (row?.present !== false)
      throw new Error('business:sale_checkout_rollback_would_lose_data');
    await runner.query(`
      ALTER TABLE sale_mutation_requests DROP CONSTRAINT sale_mutation_requests_operation_check;
      ALTER TABLE sale_mutation_requests ADD CONSTRAINT sale_mutation_requests_operation_check
        CHECK(operation IN ('create','update','complete','cancel','discard'));
      ALTER TABLE sale_events DROP CONSTRAINT sale_events_event_type_check;
      ALTER TABLE sale_events ADD CONSTRAINT sale_events_event_type_check
        CHECK(event_type IN ('create','update','complete','cancel','discard'));
    `);
  }
}
