import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive bridge. Legacy dispatch proofs and receipts are never rewritten. */
export class SharedAiGenerationOwnership1793580000000 implements MigrationInterface {
  async up(r: QueryRunner): Promise<void> {
    await r.query(`ALTER TABLE nodia_ai_job_attempts ADD CONSTRAINT uq_ai_chat_attempt_job UNIQUE(id,job_id)`);
    await r.query(`CREATE TABLE ai_generation_operations (
      id uuid PRIMARY KEY, owner_kind text NOT NULL CHECK(owner_kind IN ('chat','teacher')),
      chat_attempt_id uuid,chat_job_id uuid,chat_conversation_id uuid,
      teacher_attempt_id uuid,teacher_job_id uuid,teacher_session_id uuid,
      actor_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      auth_session_public_id uuid REFERENCES auth_sessions(public_id) ON DELETE SET NULL,
      connection_id bigint NOT NULL REFERENCES ai_providers(id) ON DELETE RESTRICT,
      selected_key_id bigint REFERENCES ai_api_keys(id) ON DELETE SET NULL,
      selection_snapshot jsonb NOT NULL,configuration_generation text NOT NULL,session_generation text NOT NULL,
      resource_key text NOT NULL,worker_id uuid NOT NULL,owner_fence bigint NOT NULL CHECK(owner_fence>0),
      runtime_fence bigint NOT NULL CHECK(runtime_fence>0),
      phase text NOT NULL CHECK(phase IN ('reserved','dispatch_armed','transport_open','closed')),
      request_hash char(64) NOT NULL,
      reserved_exchanges integer NOT NULL DEFAULT 0,started_exchanges integer NOT NULL DEFAULT 0,
      exchange_limit integer NOT NULL CHECK(exchange_limit>0),
      terminal_proof jsonb CHECK(terminal_proof IS NULL OR octet_length(terminal_proof::text)<=8192),
      remote_outcome text CHECK(remote_outcome IN ('completed','unknown')),response_hash char(64),
      api_owner_identity jsonb CHECK(api_owner_identity IS NULL OR octet_length(api_owner_identity::text)<=4096),
      acknowledged_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(id,resource_key),UNIQUE(chat_attempt_id),UNIQUE(teacher_attempt_id),
      FOREIGN KEY(chat_attempt_id,chat_job_id) REFERENCES nodia_ai_job_attempts(id,job_id) ON DELETE CASCADE,
      FOREIGN KEY(chat_job_id,chat_conversation_id) REFERENCES nodia_ai_jobs(id,conversation_id) ON DELETE CASCADE,
      FOREIGN KEY(teacher_session_id,teacher_job_id,teacher_attempt_id) REFERENCES teacher_generation_attempts(session_id,job_id,id) ON DELETE RESTRICT,
      CHECK((owner_kind='chat' AND chat_attempt_id IS NOT NULL AND id=chat_attempt_id AND chat_job_id IS NOT NULL AND chat_conversation_id IS NOT NULL AND teacher_attempt_id IS NULL AND teacher_job_id IS NULL AND teacher_session_id IS NULL)
         OR(owner_kind='teacher' AND teacher_attempt_id IS NOT NULL AND id=teacher_attempt_id AND teacher_job_id IS NOT NULL AND teacher_session_id IS NOT NULL AND chat_attempt_id IS NULL AND chat_job_id IS NULL AND chat_conversation_id IS NULL)),
      CHECK(0<=started_exchanges AND started_exchanges<=reserved_exchanges AND reserved_exchanges<=exchange_limit))`);
    await r.query(`ALTER TABLE nodia_ai_runtime_slots ADD COLUMN generation_operation_id uuid,
      ADD CONSTRAINT fk_ai_slot_generation FOREIGN KEY(generation_operation_id,resource_key) REFERENCES ai_generation_operations(id,resource_key) ON DELETE RESTRICT,
      ADD CONSTRAINT ck_ai_slot_generation_free CHECK(state<>'free' OR generation_operation_id IS NULL)`);
    await r.query(`CREATE TABLE ai_generation_qualifications (
      scope_hash char(64) PRIMARY KEY,contract_version text NOT NULL CHECK(contract_version='teacher-text/1'),
      operation_id uuid NOT NULL REFERENCES ai_generation_operations(id) ON DELETE RESTRICT,
      response_hash char(64) NOT NULL,evidence_hash char(64) NOT NULL,observed_at timestamptz NOT NULL DEFAULT now())`);
    // Preserve legacy release SQL/proofs: the linked operation remains durable after a verified release.
    await r.query(`CREATE FUNCTION release_chat_generation_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.state='free' AND OLD.generation_operation_id IS NOT NULL AND EXISTS(
        SELECT 1 FROM ai_generation_operations o WHERE o.id=OLD.generation_operation_id AND o.owner_kind='chat' AND o.chat_job_id=OLD.job_id)
      THEN NEW.generation_operation_id=NULL; END IF; RETURN NEW; END $$;
      CREATE TRIGGER release_chat_generation_link BEFORE UPDATE ON nodia_ai_runtime_slots FOR EACH ROW EXECUTE FUNCTION release_chat_generation_link()`);
  }
  async down(r: QueryRunner): Promise<void> {
    const rows: {count:string}[] = await r.query('SELECT count(*)::text FROM ai_generation_operations');
    if(rows[0]?.count!=='0') throw Error('ai_generation_rollback_requires_reconciliation');
    await r.query('DROP TABLE ai_generation_qualifications');
    await r.query('DROP TRIGGER release_chat_generation_link ON nodia_ai_runtime_slots; DROP FUNCTION release_chat_generation_link()');
    await r.query('ALTER TABLE nodia_ai_runtime_slots DROP CONSTRAINT fk_ai_slot_generation, DROP CONSTRAINT ck_ai_slot_generation_free, DROP COLUMN generation_operation_id');
    await r.query('DROP TABLE ai_generation_operations');
    await r.query('ALTER TABLE nodia_ai_job_attempts DROP CONSTRAINT uq_ai_chat_attempt_job');
  }
}
