import type { MigrationInterface, QueryRunner } from 'typeorm';

const chatOwner = `(owner_kind='chat' AND chat_attempt_id IS NOT NULL AND id=chat_attempt_id
  AND chat_job_id IS NOT NULL AND chat_conversation_id IS NOT NULL
  AND teacher_attempt_id IS NULL AND teacher_job_id IS NULL AND teacher_session_id IS NULL)`;
const teacherOwner = `(owner_kind='teacher' AND teacher_attempt_id IS NOT NULL AND id=teacher_attempt_id
  AND teacher_job_id IS NOT NULL AND teacher_session_id IS NOT NULL
  AND chat_attempt_id IS NULL AND chat_job_id IS NULL AND chat_conversation_id IS NULL)`;

/** Extend the neutral generation ledger while retaining existing owners and operation references. */
export class TeacherFlashcardLibraryGeneration1793930000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE teacher_flashcard_library_proposals (
        id uuid PRIMARY KEY,
        owner_user_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        auth_session_public_id uuid REFERENCES auth_sessions(public_id) ON DELETE SET NULL,
        request_key uuid NOT NULL,
        request_hash char(64) NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
        origin jsonb CHECK(origin IS NULL OR (jsonb_typeof(origin)='object' AND octet_length(origin::text)<=16384)),
        budget_parts smallint NOT NULL CHECK(budget_parts BETWEEN 1 AND 2),
        qualification boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        queue_expires_at timestamptz NOT NULL DEFAULT (clock_timestamp()+interval '10 minutes'),
        expires_at timestamptz NOT NULL DEFAULT (clock_timestamp()+interval '24 hours'),
        purged_at timestamptz,
        CHECK((origin IS NULL)=(purged_at IS NOT NULL)),
        UNIQUE(owner_user_id,request_key),
        UNIQUE(id,owner_user_id)
      );
      CREATE INDEX ix_flashcard_library_owner_budget
        ON teacher_flashcard_library_proposals(owner_user_id,created_at);
      CREATE INDEX ix_flashcard_library_owner_semantic
        ON teacher_flashcard_library_proposals(owner_user_id,request_hash);
      CREATE INDEX ix_flashcard_library_purge
        ON teacher_flashcard_library_proposals(expires_at) WHERE purged_at IS NULL;
      CREATE TABLE teacher_flashcard_library_parts (
        id uuid PRIMARY KEY,
        proposal_id uuid NOT NULL REFERENCES teacher_flashcard_library_proposals(id) ON DELETE RESTRICT,
        kind text NOT NULL CHECK(kind IN ('text','image')),
        state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','ready','failed','unknown')),
        selection_snapshot jsonb NOT NULL CHECK(jsonb_typeof(selection_snapshot)='object'
          AND octet_length(selection_snapshot::text)<=8192
          AND coalesce(selection_snapshot->>'mode'='api_key',false)),
        configuration_generation text NOT NULL,
        session_generation text NOT NULL,
        resource_key text NOT NULL,
        prompt text CHECK(prompt IS NULL OR octet_length(prompt) BETWEEN 1 AND 49152),
        text_value jsonb CHECK(text_value IS NULL OR (kind='text' AND jsonb_typeof(text_value)='object' AND octet_length(text_value::text)<=16384)),
        image_mime text,
        image_bytes bytea,
        CHECK((image_mime IS NULL AND image_bytes IS NULL) OR
          (kind='image' AND image_mime IS NOT NULL AND image_mime='image/webp'
           AND image_bytes IS NOT NULL AND octet_length(image_bytes) BETWEEN 1 AND 147456)),
        error_code text CHECK(error_code IS NULL OR error_code ~ '^[a-z0-9_]{1,100}$'),
        deadline_at timestamptz,
        lease_until timestamptz,
        purged_at timestamptz,
        UNIQUE(proposal_id,kind),
        UNIQUE(proposal_id,id),
        CHECK(state<>'running' OR (deadline_at IS NOT NULL AND lease_until IS NOT NULL)),
        CHECK((state='ready' AND purged_at IS NULL)=(text_value IS NOT NULL OR image_bytes IS NOT NULL)),
        CHECK(purged_at IS NULL OR (prompt IS NULL AND text_value IS NULL AND image_bytes IS NULL))
      );
      CREATE INDEX ix_flashcard_library_pending
        ON teacher_flashcard_library_parts(proposal_id,kind) WHERE state='queued';
      ALTER TABLE ai_generation_operations
        DROP CONSTRAINT ai_generation_operations_owner_kind_check,
        ADD CONSTRAINT ai_generation_operations_owner_kind_check
          CHECK(owner_kind IN ('chat','teacher','flashcard_library')),
        ADD COLUMN flashcard_proposal_id uuid,
        ADD COLUMN flashcard_part_id uuid;
      DO $migration$
      DECLARE old_ownership name;
      BEGIN
        SELECT conname INTO STRICT old_ownership FROM pg_constraint
        WHERE conrelid='ai_generation_operations'::regclass AND contype='c'
          AND pg_get_constraintdef(oid) LIKE '%chat_attempt_id IS NOT NULL%'
          AND pg_get_constraintdef(oid) LIKE '%teacher_attempt_id IS NOT NULL%';
        EXECUTE format('ALTER TABLE ai_generation_operations DROP CONSTRAINT %I',old_ownership);
      END $migration$;
      ALTER TABLE ai_generation_operations
        ADD CONSTRAINT ck_generation_owner_reference CHECK(
          ((${chatOwner} OR ${teacherOwner}) AND flashcard_proposal_id IS NULL AND flashcard_part_id IS NULL)
          OR (owner_kind='flashcard_library' AND flashcard_proposal_id IS NOT NULL
              AND flashcard_part_id IS NOT NULL AND id=flashcard_part_id
              AND chat_attempt_id IS NULL AND chat_job_id IS NULL AND chat_conversation_id IS NULL
              AND teacher_attempt_id IS NULL AND teacher_job_id IS NULL AND teacher_session_id IS NULL
              AND exchange_limit=1 AND coalesce(selection_snapshot->>'mode'='api_key',false))),
        ADD CONSTRAINT fk_generation_library_owner FOREIGN KEY(flashcard_proposal_id,actor_id)
          REFERENCES teacher_flashcard_library_proposals(id,owner_user_id) ON DELETE RESTRICT,
        ADD CONSTRAINT fk_generation_library_part FOREIGN KEY(flashcard_proposal_id,flashcard_part_id)
          REFERENCES teacher_flashcard_library_parts(proposal_id,id) ON DELETE RESTRICT;
      CREATE INDEX ix_flashcard_library_open_operations ON ai_generation_operations(actor_id,created_at)
        WHERE owner_kind='flashcard_library' AND acknowledged_at IS NULL;
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE teacher_flashcard_library_proposals,teacher_flashcard_library_parts,ai_generation_operations
        IN ACCESS EXCLUSIVE MODE;
      DO $guard$
      BEGIN
        IF EXISTS(SELECT 1 FROM teacher_flashcard_library_proposals)
           OR EXISTS(SELECT 1 FROM ai_generation_operations WHERE owner_kind='flashcard_library') THEN
          RAISE EXCEPTION 'Preserve the flashcard generation receipts before removing this migration';
        END IF;
      END $guard$;
      DROP INDEX ix_flashcard_library_open_operations;
      ALTER TABLE ai_generation_operations
        DROP CONSTRAINT fk_generation_library_owner,
        DROP CONSTRAINT fk_generation_library_part,
        DROP CONSTRAINT ck_generation_owner_reference,
        DROP CONSTRAINT ai_generation_operations_owner_kind_check,
        ADD CONSTRAINT ai_generation_operations_owner_kind_check CHECK(owner_kind IN ('chat','teacher')),
        ADD CONSTRAINT ck_generation_owner_reference CHECK(${chatOwner} OR ${teacherOwner}),
        DROP COLUMN flashcard_proposal_id,
        DROP COLUMN flashcard_part_id;
      DROP TABLE teacher_flashcard_library_parts,teacher_flashcard_library_proposals;
    `);
  }
}
