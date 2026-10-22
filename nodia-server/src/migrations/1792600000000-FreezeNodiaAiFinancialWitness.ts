import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Preserve a committed local witness without adding a second receipt store. */
export class FreezeNodiaAiFinancialWitness1792600000000 implements MigrationInterface {
  name = 'FreezeNodiaAiFinancialWitness1792600000000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE FUNCTION nodia_ai_freeze_execution_witness() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_TABLE_NAME='nodia_ai_execution_steps' THEN
          IF OLD.bound_command_hash IS NOT NULL AND NEW.bound_command_hash IS DISTINCT FROM OLD.bound_command_hash THEN
            RAISE EXCEPTION 'nodia_ai:immutable_execution_binding';
          END IF;
          IF OLD.state='completed' AND ROW(NEW.state,NEW.minimal_receipt,NEW.dispatched_at,NEW.completed_at,NEW.error_code)
            IS DISTINCT FROM ROW(OLD.state,OLD.minimal_receipt,OLD.dispatched_at,OLD.completed_at,OLD.error_code) THEN
            RAISE EXCEPTION 'nodia_ai:immutable_execution_receipt';
          END IF;
        ELSE
          IF OLD.state='completed' AND ROW(NEW.state,NEW.revision,NEW.completed_at)
            IS DISTINCT FROM ROW(OLD.state,OLD.revision,OLD.completed_at) THEN
            RAISE EXCEPTION 'nodia_ai:immutable_completed_execution';
          END IF;
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER trg_nodia_ai_execution_step_witness BEFORE UPDATE ON nodia_ai_execution_steps
        FOR EACH ROW EXECUTE FUNCTION nodia_ai_freeze_execution_witness();
      CREATE TRIGGER trg_nodia_ai_execution_witness BEFORE UPDATE ON nodia_ai_executions
        FOR EACH ROW EXECUTE FUNCTION nodia_ai_freeze_execution_witness();
    `);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      DROP TRIGGER trg_nodia_ai_execution_step_witness ON nodia_ai_execution_steps;
      DROP TRIGGER trg_nodia_ai_execution_witness ON nodia_ai_executions;
      DROP FUNCTION nodia_ai_freeze_execution_witness();
    `);
  }
}
