import type { MigrationInterface, QueryRunner } from 'typeorm';
/** M2 only. No challenges, execution identities, effects or new business permissions. */
export class CreateNodiaAiProposalPersistence1792400000000 implements MigrationInterface {
  name = 'CreateNodiaAiProposalPersistence1792400000000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE nodia_ai_proposals (
        id uuid PRIMARY KEY,
        conversation_id uuid NOT NULL REFERENCES nodia_ai_conversations(id) ON DELETE CASCADE,
        actor_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        current_revision integer NOT NULL CHECK(current_revision>0),
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(id,conversation_id)
      );
      CREATE INDEX ix_nodia_ai_proposals_chat ON nodia_ai_proposals(conversation_id,created_at,id);
      CREATE TABLE nodia_ai_proposal_revisions (
        proposal_id uuid NOT NULL REFERENCES nodia_ai_proposals(id) ON DELETE CASCADE,
        revision integer NOT NULL CHECK(revision>0),
        state text NOT NULL CHECK(state IN ('draft','ready','confirmed','superseded','cancelled','expired','invalidated')),
        hash char(64) NOT NULL CHECK(hash ~ '^[0-9a-f]{64}$'),
        catalog_version text NOT NULL CHECK(octet_length(catalog_version) BETWEEN 1 AND 256),
        canonicalization_version text NOT NULL CHECK(canonicalization_version='jcs-rfc8785/1'),
        created_at timestamptz NOT NULL,
        expires_at timestamptz NOT NULL CHECK(expires_at>created_at),
        PRIMARY KEY(proposal_id,revision)
      );
      CREATE INDEX ix_nodia_ai_proposal_revisions_state ON nodia_ai_proposal_revisions(proposal_id,state);
      ALTER TABLE nodia_ai_proposals ADD CONSTRAINT fk_nodia_ai_proposals_current
        FOREIGN KEY(id,current_revision) REFERENCES nodia_ai_proposal_revisions(proposal_id,revision)
        DEFERRABLE INITIALLY DEFERRED;
      CREATE TABLE nodia_ai_proposal_steps (
        id uuid PRIMARY KEY,
        proposal_id uuid NOT NULL,
        proposal_revision integer NOT NULL,
        position integer NOT NULL CHECK(position>0),
        tool_name text NOT NULL CHECK(octet_length(tool_name) BETWEEN 1 AND 256),
        contract_hash char(64) NOT NULL CHECK(contract_hash ~ '^[0-9a-f]{64}$'),
        kind text NOT NULL CHECK(kind IN ('domain_change','secure_flow','preference_change')),
        effect_key text NOT NULL CHECK(octet_length(effect_key) BETWEEN 1 AND 256),
        scope jsonb NOT NULL CHECK(jsonb_typeof(scope)='object' AND octet_length(scope::text)<=65536),
        command_template jsonb NOT NULL CHECK(jsonb_typeof(command_template)='object' AND octet_length(command_template::text)<=65536),
        public_step jsonb NOT NULL CHECK(jsonb_typeof(public_step)='object' AND octet_length(public_step::text)<=65536),
        output_bindings jsonb NOT NULL CHECK(jsonb_typeof(output_bindings)='array' AND octet_length(output_bindings::text)<=65536),
        preconditions jsonb NOT NULL CHECK(jsonb_typeof(preconditions)='object' AND octet_length(preconditions::text)<=65536),
        FOREIGN KEY(proposal_id,proposal_revision) REFERENCES nodia_ai_proposal_revisions(proposal_id,revision) ON DELETE CASCADE,
        UNIQUE(proposal_id,proposal_revision,position), UNIQUE(id,proposal_id,proposal_revision)
      );
      CREATE TABLE nodia_ai_drafts (
        id uuid PRIMARY KEY,
        conversation_id uuid NOT NULL REFERENCES nodia_ai_conversations(id) ON DELETE CASCADE,
        actor_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        tool_call_id uuid,
        tool_name text NOT NULL CHECK(octet_length(tool_name) BETWEEN 1 AND 256),
        catalog_version text NOT NULL CHECK(octet_length(catalog_version) BETWEEN 1 AND 256),
        revision integer NOT NULL CHECK(revision>0),
        scope jsonb NOT NULL CHECK(jsonb_typeof(scope)='object' AND octet_length(scope::text)<=65536),
        partial_command jsonb NOT NULL CHECK(jsonb_typeof(partial_command)='object' AND octet_length(partial_command::text)<=65536),
        clarifications jsonb NOT NULL CHECK(jsonb_typeof(clarifications)='object' AND octet_length(clarifications::text)<=65536),
        state text NOT NULL CHECK(state IN ('incomplete','ready','claimed','cancelled','invalidated')),
        claimed_proposal_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(id,conversation_id),
        FOREIGN KEY(tool_call_id,conversation_id) REFERENCES nodia_ai_tool_calls(id,conversation_id) DEFERRABLE INITIALLY DEFERRED,
        FOREIGN KEY(claimed_proposal_id,conversation_id) REFERENCES nodia_ai_proposals(id,conversation_id) DEFERRABLE INITIALLY DEFERRED,
        CHECK(state<>'claimed' OR claimed_proposal_id IS NOT NULL)
      );
      CREATE INDEX ix_nodia_ai_drafts_chat ON nodia_ai_drafts(conversation_id,state,updated_at);
      CREATE INDEX ix_nodia_ai_drafts_tool ON nodia_ai_drafts(tool_call_id,conversation_id) WHERE tool_call_id IS NOT NULL;
      CREATE INDEX ix_nodia_ai_drafts_proposal ON nodia_ai_drafts(claimed_proposal_id,conversation_id) WHERE claimed_proposal_id IS NOT NULL;
      CREATE FUNCTION nodia_ai_freeze_proposal_content() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE parent_state text;
      BEGIN
        IF TG_OP='DELETE' THEN
          IF TG_TABLE_NAME='nodia_ai_proposals' THEN
            IF EXISTS(SELECT 1 FROM nodia_ai_conversations WHERE id=OLD.conversation_id) THEN RAISE EXCEPTION 'nodia_ai:immutable_proposal'; END IF;
          ELSIF TG_TABLE_NAME='nodia_ai_proposal_revisions' THEN
            IF EXISTS(SELECT 1 FROM nodia_ai_proposals WHERE id=OLD.proposal_id) THEN RAISE EXCEPTION 'nodia_ai:immutable_revision'; END IF;
          ELSE
            IF EXISTS(SELECT 1 FROM nodia_ai_proposal_revisions WHERE proposal_id=OLD.proposal_id AND revision=OLD.proposal_revision) THEN RAISE EXCEPTION 'nodia_ai:immutable_step'; END IF;
          END IF;
          RETURN OLD;
        END IF;
        IF TG_TABLE_NAME='nodia_ai_proposals' THEN
          IF ROW(NEW.id,NEW.conversation_id,NEW.actor_id,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.conversation_id,OLD.actor_id,OLD.created_at) THEN
            RAISE EXCEPTION 'nodia_ai:immutable_proposal';
          END IF;
          RETURN NEW;
        END IF;
        IF TG_TABLE_NAME='nodia_ai_proposal_revisions' THEN
          IF OLD.state<>'draft' AND ROW(NEW.proposal_id,NEW.revision,NEW.hash,NEW.catalog_version,NEW.canonicalization_version,NEW.created_at,NEW.expires_at)
            IS DISTINCT FROM ROW(OLD.proposal_id,OLD.revision,OLD.hash,OLD.catalog_version,OLD.canonicalization_version,OLD.created_at,OLD.expires_at) THEN
            RAISE EXCEPTION 'nodia_ai:immutable_revision';
          END IF;
          IF NEW.state='draft' AND OLD.state<>'draft' THEN RAISE EXCEPTION 'nodia_ai:immutable_revision'; END IF;
          RETURN NEW;
        END IF;
        SELECT state INTO parent_state FROM nodia_ai_proposal_revisions WHERE proposal_id=NEW.proposal_id AND revision=NEW.proposal_revision;
        IF TG_OP='UPDATE' OR parent_state IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'nodia_ai:immutable_step'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER trg_nodia_ai_proposals_identity BEFORE UPDATE OR DELETE ON nodia_ai_proposals FOR EACH ROW EXECUTE FUNCTION nodia_ai_freeze_proposal_content();
      CREATE TRIGGER trg_nodia_ai_revision_frozen BEFORE UPDATE OR DELETE ON nodia_ai_proposal_revisions FOR EACH ROW EXECUTE FUNCTION nodia_ai_freeze_proposal_content();
      CREATE TRIGGER trg_nodia_ai_step_frozen BEFORE INSERT OR UPDATE OR DELETE ON nodia_ai_proposal_steps FOR EACH ROW EXECUTE FUNCTION nodia_ai_freeze_proposal_content();
    `);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DROP TABLE nodia_ai_drafts; ALTER TABLE nodia_ai_proposals DROP CONSTRAINT fk_nodia_ai_proposals_current;
      DROP TABLE nodia_ai_proposal_steps; DROP TABLE nodia_ai_proposal_revisions; DROP TABLE nodia_ai_proposals;
      DROP FUNCTION nodia_ai_freeze_proposal_content();`);
  }
}
