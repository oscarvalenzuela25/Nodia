import type { MigrationInterface, QueryRunner } from 'typeorm';

/** One durable first-binding per local step, without a second command ledger. */
export class AddNodiaAiWorkflowBindings1792700000000 implements MigrationInterface {
  name = 'AddNodiaAiWorkflowBindings1792700000000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE nodia_ai_execution_steps ADD COLUMN bound_command jsonb;
      ALTER TABLE nodia_ai_proposals ADD COLUMN prior_execution_id uuid
        REFERENCES nodia_ai_executions(id) ON DELETE SET NULL;
      ALTER TABLE nodia_ai_execution_steps ADD CONSTRAINT ck_nodia_ai_bound_command CHECK(
        bound_command IS NULL OR (
          jsonb_typeof(bound_command)='object' AND octet_length(bound_command::text)<=262144
          AND bound_command_hash IS NOT NULL AND source_step_id IS NOT NULL
        )
      );
      CREATE FUNCTION nodia_ai_freeze_bound_payload() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.source_step_id IS NOT NULL AND NEW.source_step_id IS NULL THEN
          NEW.bound_command := NULL;
          RETURN NEW;
        END IF;
        IF OLD.bound_command IS NOT NULL AND NEW.bound_command IS DISTINCT FROM OLD.bound_command THEN
          RAISE EXCEPTION 'nodia_ai:immutable_execution_binding';
        END IF;
        IF OLD.bound_command IS NULL AND NEW.bound_command IS NOT NULL AND OLD.bound_command_hash IS NOT NULL THEN
          RAISE EXCEPTION 'nodia_ai:immutable_execution_binding';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER trg_nodia_ai_execution_step_bound_payload BEFORE UPDATE ON nodia_ai_execution_steps
        FOR EACH ROW EXECUTE FUNCTION nodia_ai_freeze_bound_payload();
      CREATE FUNCTION nodia_ai_freeze_workflow_origin() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.prior_execution_id IS DISTINCT FROM OLD.prior_execution_id AND NOT (
          NEW.prior_execution_id IS NULL AND NOT EXISTS(SELECT 1 FROM nodia_ai_executions WHERE id=OLD.prior_execution_id)
        ) THEN RAISE EXCEPTION 'nodia_ai:immutable_workflow_origin'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER trg_nodia_ai_proposal_workflow_origin BEFORE UPDATE ON nodia_ai_proposals
        FOR EACH ROW EXECUTE FUNCTION nodia_ai_freeze_workflow_origin();
      CREATE TRIGGER trg_nodia_ai_execution_workflow_origin BEFORE UPDATE ON nodia_ai_executions
        FOR EACH ROW EXECUTE FUNCTION nodia_ai_freeze_workflow_origin();
    `);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      DO $$ BEGIN
        IF EXISTS(SELECT 1 FROM nodia_ai_execution_steps WHERE bound_command IS NOT NULL)
          OR EXISTS(SELECT 1 FROM nodia_ai_proposals WHERE prior_execution_id IS NOT NULL) THEN
          RAISE EXCEPTION 'nodia_ai:workflow_binding_rollback_requires_empty_payloads';
        END IF;
      END $$;
      DROP TRIGGER trg_nodia_ai_execution_step_bound_payload ON nodia_ai_execution_steps;
      DROP FUNCTION nodia_ai_freeze_bound_payload();
      DROP TRIGGER trg_nodia_ai_proposal_workflow_origin ON nodia_ai_proposals;
      DROP TRIGGER trg_nodia_ai_execution_workflow_origin ON nodia_ai_executions;
      DROP FUNCTION nodia_ai_freeze_workflow_origin();
      ALTER TABLE nodia_ai_execution_steps DROP CONSTRAINT ck_nodia_ai_bound_command;
      ALTER TABLE nodia_ai_execution_steps DROP COLUMN bound_command;
      ALTER TABLE nodia_ai_proposals DROP COLUMN prior_execution_id;
    `);
  }
}
