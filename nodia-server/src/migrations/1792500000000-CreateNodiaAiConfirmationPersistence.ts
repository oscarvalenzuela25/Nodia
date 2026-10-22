import type { MigrationInterface, QueryRunner } from 'typeorm';
/** Human approval identities only. No execution payloads or native writer is enabled. */
export class CreateNodiaAiConfirmationPersistence1792500000000 implements MigrationInterface {
  name = 'CreateNodiaAiConfirmationPersistence1792500000000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE nodia_ai_confirmation_challenges (
        id uuid PRIMARY KEY,
        proposal_id uuid NOT NULL,
        proposal_revision integer NOT NULL CHECK(proposal_revision>0),
        actor_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        session_public_id uuid REFERENCES auth_sessions(public_id) ON DELETE SET NULL,
        expected_hash char(64) NOT NULL CHECK(expected_hash ~ '^[0-9a-f]{64}$'),
        token_hash char(64) NOT NULL UNIQUE CHECK(token_hash ~ '^[0-9a-f]{64}$'),
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz,
        created_at timestamptz NOT NULL,
        FOREIGN KEY(proposal_id,proposal_revision) REFERENCES nodia_ai_proposal_revisions(proposal_id,revision) ON DELETE CASCADE,
        UNIQUE(proposal_id,proposal_revision,actor_id,session_public_id),
        CHECK(expires_at>created_at), CHECK(consumed_at IS NULL OR consumed_at>=created_at)
      );
      CREATE INDEX ix_nodia_ai_challenges_expiry ON nodia_ai_confirmation_challenges(expires_at);
      CREATE INDEX ix_nodia_ai_challenges_session ON nodia_ai_confirmation_challenges(session_public_id) WHERE session_public_id IS NOT NULL;
      CREATE TABLE nodia_ai_executions (
        id uuid PRIMARY KEY,
        conversation_id uuid REFERENCES nodia_ai_conversations(id) ON DELETE SET NULL,
        proposal_id uuid REFERENCES nodia_ai_proposals(id) ON DELETE SET NULL,
        origin_conversation_id uuid NOT NULL,
        origin_proposal_id uuid NOT NULL UNIQUE,
        origin_proposal_revision integer NOT NULL CHECK(origin_proposal_revision>0),
        proposal_hash char(64) NOT NULL CHECK(proposal_hash ~ '^[0-9a-f]{64}$'),
        actor_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        chat_owner_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        client_request_id uuid NOT NULL,
        catalog_version text NOT NULL CHECK(octet_length(catalog_version) BETWEEN 1 AND 256),
        revision integer NOT NULL CHECK(revision>0),
        state text NOT NULL CHECK(state IN ('queued','running','waiting_for_user','completed','partially_completed','failed','cancel_requested','cancelled','unknown')),
        minimal_scope jsonb NOT NULL CHECK(jsonb_typeof(minimal_scope)='object' AND octet_length(minimal_scope::text)<=65536),
        prior_execution_id uuid REFERENCES nodia_ai_executions(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL,
        completed_at timestamptz,
        retention_epoch bigint NOT NULL CHECK(retention_epoch>=0),
        UNIQUE(actor_id,client_request_id), UNIQUE(id,conversation_id),
        FOREIGN KEY(proposal_id,conversation_id) REFERENCES nodia_ai_proposals(id,conversation_id) DEFERRABLE INITIALLY DEFERRED,
        FOREIGN KEY(proposal_id,origin_proposal_revision) REFERENCES nodia_ai_proposal_revisions(proposal_id,revision) DEFERRABLE INITIALLY DEFERRED,
        CHECK(proposal_id IS NULL OR proposal_id=origin_proposal_id),
        CHECK(conversation_id IS NULL OR conversation_id=origin_conversation_id),
        CHECK(actor_id=chat_owner_id),
        CHECK(completed_at IS NULL OR completed_at>=created_at)
      );
      CREATE INDEX ix_nodia_ai_executions_chat ON nodia_ai_executions(conversation_id,created_at,id);
      CREATE INDEX ix_nodia_ai_executions_actor ON nodia_ai_executions(actor_id,created_at,id);
      CREATE UNIQUE INDEX uq_nodia_ai_execution_active_chat ON nodia_ai_executions(conversation_id) WHERE conversation_id IS NOT NULL AND state IN ('queued','running','waiting_for_user','cancel_requested','unknown');
      CREATE TABLE nodia_ai_execution_steps (
        id uuid PRIMARY KEY,
        execution_id uuid NOT NULL REFERENCES nodia_ai_executions(id) ON DELETE CASCADE,
        source_step_id uuid REFERENCES nodia_ai_proposal_steps(id) ON DELETE SET NULL,
        position integer NOT NULL CHECK(position>0),
        tool_name text NOT NULL CHECK(octet_length(tool_name) BETWEEN 1 AND 256),
        template_hash char(64) NOT NULL CHECK(template_hash ~ '^[0-9a-f]{64}$'),
        bound_command_hash char(64) CHECK(bound_command_hash IS NULL OR bound_command_hash ~ '^[0-9a-f]{64}$'),
        native_request_key uuid NOT NULL UNIQUE,
        state text NOT NULL CHECK(state IN ('blocked','ready','running','waiting_for_user','completed','failed','unknown','skipped','cancelled')),
        minimal_scope jsonb NOT NULL CHECK(jsonb_typeof(minimal_scope)='object' AND octet_length(minimal_scope::text)<=65536),
        minimal_receipt jsonb CHECK(minimal_receipt IS NULL OR (jsonb_typeof(minimal_receipt)='object' AND octet_length(minimal_receipt::text)<=65536)),
        recovery_descriptor jsonb CHECK(recovery_descriptor IS NULL OR (jsonb_typeof(recovery_descriptor)='object' AND octet_length(recovery_descriptor::text)<=8192)),
        lease_fence bigint NOT NULL CHECK(lease_fence>=0),
        error_code text CHECK(error_code IS NULL OR error_code ~ '^nodia_ai:[a-z0-9_]{1,100}$'),
        dispatched_at timestamptz,
        completed_at timestamptz,
        UNIQUE(execution_id,position),
        CHECK(source_step_id IS NULL OR source_step_id=id),
        CHECK(state<>'completed' OR (minimal_receipt IS NOT NULL AND bound_command_hash IS NOT NULL AND completed_at IS NOT NULL))
      );
      CREATE INDEX ix_nodia_ai_execution_steps_state ON nodia_ai_execution_steps(execution_id,state,position);
      ALTER TABLE nodia_ai_jobs ADD COLUMN execution_id uuid;
      ALTER TABLE nodia_ai_jobs DROP CONSTRAINT nodia_ai_jobs_kind_check;
      ALTER TABLE nodia_ai_jobs ADD CONSTRAINT nodia_ai_jobs_kind_check CHECK(kind IN ('turn','execution','expire_chat','delete_blob','reconcile'));
      ALTER TABLE nodia_ai_jobs ADD CONSTRAINT fk_nodia_ai_jobs_execution FOREIGN KEY(execution_id,conversation_id) REFERENCES nodia_ai_executions(id,conversation_id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
      ALTER TABLE nodia_ai_jobs ADD CONSTRAINT ck_nodia_ai_jobs_execution_scope CHECK(execution_id IS NULL OR (conversation_id IS NOT NULL AND run_id IS NULL AND kind='execution'));
      ALTER TABLE nodia_ai_jobs ADD CONSTRAINT ck_nodia_ai_jobs_execution_target CHECK(kind<>'execution' OR execution_id IS NOT NULL OR (state='unknown' AND recovery_descriptor IS NOT NULL));
      CREATE INDEX ix_nodia_ai_jobs_execution ON nodia_ai_jobs(execution_id) WHERE execution_id IS NOT NULL;
      ALTER TABLE nodia_ai_execution_grants ALTER COLUMN run_id DROP NOT NULL;
      ALTER TABLE nodia_ai_execution_grants ADD COLUMN execution_id uuid UNIQUE REFERENCES nodia_ai_executions(id) ON DELETE CASCADE;
      ALTER TABLE nodia_ai_execution_grants ADD COLUMN command_set_hash char(64);
      ALTER TABLE nodia_ai_execution_grants ADD CONSTRAINT ck_nodia_ai_grant_target CHECK(num_nonnulls(run_id,execution_id)=1);
      ALTER TABLE nodia_ai_execution_grants ADD CONSTRAINT ck_nodia_ai_grant_hash CHECK((execution_id IS NOT NULL AND command_set_hash IS NOT NULL AND command_set_hash ~ '^[0-9a-f]{64}$') OR (execution_id IS NULL AND command_set_hash IS NULL));
      ALTER TABLE nodia_ai_events ADD COLUMN execution_id uuid;
      ALTER TABLE nodia_ai_events ADD CONSTRAINT fk_nodia_ai_event_execution FOREIGN KEY(execution_id,conversation_id) REFERENCES nodia_ai_executions(id,conversation_id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
      ALTER TABLE nodia_ai_events ADD CONSTRAINT ck_nodia_ai_event_target CHECK(num_nonnulls(run_id,execution_id)<=1);
      CREATE INDEX ix_nodia_ai_events_execution_seq ON nodia_ai_events(execution_id,seq) WHERE execution_id IS NOT NULL;
      CREATE FUNCTION nodia_ai_freeze_execution_identity() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP='DELETE' THEN
          IF EXISTS(SELECT 1 FROM nodia_ai_executions WHERE id=OLD.execution_id) THEN RAISE EXCEPTION 'nodia_ai:immutable_execution_step'; END IF;
          RETURN OLD;
        END IF;
        IF TG_OP='INSERT' THEN
          IF NEW.source_step_id IS NULL OR NOT EXISTS(SELECT 1 FROM nodia_ai_proposal_steps s JOIN nodia_ai_executions e ON e.origin_proposal_id=s.proposal_id AND e.origin_proposal_revision=s.proposal_revision WHERE s.id=NEW.source_step_id AND e.id=NEW.execution_id) THEN RAISE EXCEPTION 'nodia_ai:execution_step_origin_mismatch'; END IF;
          RETURN NEW;
        END IF;
        IF TG_TABLE_NAME='nodia_ai_executions' THEN
          IF ROW(NEW.id,NEW.origin_conversation_id,NEW.origin_proposal_id,NEW.origin_proposal_revision,NEW.proposal_hash,NEW.actor_id,NEW.chat_owner_id,NEW.client_request_id,NEW.catalog_version,NEW.minimal_scope,NEW.created_at,NEW.retention_epoch)
            IS DISTINCT FROM ROW(OLD.id,OLD.origin_conversation_id,OLD.origin_proposal_id,OLD.origin_proposal_revision,OLD.proposal_hash,OLD.actor_id,OLD.chat_owner_id,OLD.client_request_id,OLD.catalog_version,OLD.minimal_scope,OLD.created_at,OLD.retention_epoch) THEN
            RAISE EXCEPTION 'nodia_ai:immutable_execution';
          END IF;
        ELSE
          IF ROW(NEW.id,NEW.execution_id,NEW.position,NEW.tool_name,NEW.template_hash,NEW.native_request_key,NEW.minimal_scope)
            IS DISTINCT FROM ROW(OLD.id,OLD.execution_id,OLD.position,OLD.tool_name,OLD.template_hash,OLD.native_request_key,OLD.minimal_scope) THEN
            RAISE EXCEPTION 'nodia_ai:immutable_execution_step';
          END IF;
          IF OLD.source_step_id IS NULL AND NEW.source_step_id IS NOT NULL THEN RAISE EXCEPTION 'nodia_ai:immutable_execution_step'; END IF;
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER trg_nodia_ai_execution_identity BEFORE UPDATE ON nodia_ai_executions FOR EACH ROW EXECUTE FUNCTION nodia_ai_freeze_execution_identity();
      CREATE TRIGGER trg_nodia_ai_execution_step_identity BEFORE INSERT OR UPDATE OR DELETE ON nodia_ai_execution_steps FOR EACH ROW EXECUTE FUNCTION nodia_ai_freeze_execution_identity();
    `);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      DO $$ BEGIN IF EXISTS(SELECT 1 FROM nodia_ai_executions) THEN RAISE EXCEPTION 'nodia_ai:execution_rollback_requires_empty'; END IF; END $$;
      DROP INDEX ix_nodia_ai_events_execution_seq;
      ALTER TABLE nodia_ai_events DROP CONSTRAINT fk_nodia_ai_event_execution, DROP CONSTRAINT ck_nodia_ai_event_target, DROP COLUMN execution_id;
      ALTER TABLE nodia_ai_execution_grants DROP CONSTRAINT ck_nodia_ai_grant_target, DROP CONSTRAINT ck_nodia_ai_grant_hash, DROP COLUMN command_set_hash, DROP COLUMN execution_id;
      ALTER TABLE nodia_ai_execution_grants ALTER COLUMN run_id SET NOT NULL;
      DROP INDEX ix_nodia_ai_jobs_execution;
      ALTER TABLE nodia_ai_jobs DROP CONSTRAINT fk_nodia_ai_jobs_execution, DROP CONSTRAINT ck_nodia_ai_jobs_execution_scope, DROP CONSTRAINT ck_nodia_ai_jobs_execution_target, DROP COLUMN execution_id;
      ALTER TABLE nodia_ai_jobs DROP CONSTRAINT nodia_ai_jobs_kind_check;
      ALTER TABLE nodia_ai_jobs ADD CONSTRAINT nodia_ai_jobs_kind_check CHECK(kind IN ('turn','expire_chat','delete_blob','reconcile'));
      DROP TABLE nodia_ai_execution_steps;
      DROP TABLE nodia_ai_executions;
      DROP FUNCTION nodia_ai_freeze_execution_identity();
      DROP TABLE nodia_ai_confirmation_challenges;
    `);
  }
}
