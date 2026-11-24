import type { MigrationInterface, QueryRunner } from 'typeorm';

const previousOwners = `(
  (owner_kind='chat' AND chat_attempt_id IS NOT NULL AND id=chat_attempt_id
    AND chat_job_id IS NOT NULL AND chat_conversation_id IS NOT NULL
    AND teacher_attempt_id IS NULL AND teacher_job_id IS NULL AND teacher_session_id IS NULL
    AND flashcard_proposal_id IS NULL AND flashcard_part_id IS NULL)
  OR (owner_kind='teacher' AND teacher_attempt_id IS NOT NULL AND id=teacher_attempt_id
    AND teacher_job_id IS NOT NULL AND teacher_session_id IS NOT NULL
    AND chat_attempt_id IS NULL AND chat_job_id IS NULL AND chat_conversation_id IS NULL
    AND flashcard_proposal_id IS NULL AND flashcard_part_id IS NULL)
  OR (owner_kind='flashcard_library' AND flashcard_proposal_id IS NOT NULL
    AND flashcard_part_id IS NOT NULL AND id=flashcard_part_id
    AND chat_attempt_id IS NULL AND chat_job_id IS NULL AND chat_conversation_id IS NULL
    AND teacher_attempt_id IS NULL AND teacher_job_id IS NULL AND teacher_session_id IS NULL
    AND exchange_limit=1 AND coalesce(selection_snapshot->>'mode'='api_key',false))
)`;

export class AttachNodiaCvGenerationLedger1793980000000 implements MigrationInterface {
  name = 'AttachNodiaCvGenerationLedger1793980000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE ai_generation_operations
        ADD COLUMN cv_generation_id uuid,
        DROP CONSTRAINT ai_generation_operations_owner_kind_check,
        DROP CONSTRAINT ck_generation_owner_reference,
        ADD CONSTRAINT ai_generation_operations_owner_kind_check
          CHECK(owner_kind IN ('chat','teacher','flashcard_library','cv')),
        ADD CONSTRAINT ck_generation_owner_reference CHECK(
          (${previousOwners} AND cv_generation_id IS NULL)
          OR (owner_kind='cv' AND cv_generation_id IS NOT NULL AND id=cv_generation_id
            AND chat_attempt_id IS NULL AND chat_job_id IS NULL AND chat_conversation_id IS NULL
            AND teacher_attempt_id IS NULL AND teacher_job_id IS NULL AND teacher_session_id IS NULL
            AND flashcard_proposal_id IS NULL AND flashcard_part_id IS NULL
            AND exchange_limit=1
            AND coalesce(selection_snapshot->>'mode' IN ('api_key','agentic'),false))),
        ADD CONSTRAINT fk_generation_cv_owner FOREIGN KEY(cv_generation_id,actor_id)
          REFERENCES nodia_cv_generations(id,owner_user_id) ON DELETE RESTRICT;

      CREATE INDEX ix_generation_library_cv_open_operations
        ON ai_generation_operations(actor_id)
        WHERE owner_kind IN ('flashcard_library','cv') AND acknowledged_at IS NULL;
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE ai_generation_operations IN ACCESS EXCLUSIVE MODE;
      DO $guard$
      BEGIN
        IF EXISTS (SELECT 1 FROM ai_generation_operations WHERE owner_kind='cv') THEN
          RAISE EXCEPTION 'Preserve Nodia CV generation receipts before reverting';
        END IF;
      END $guard$;

      DROP INDEX ix_generation_library_cv_open_operations;
      ALTER TABLE ai_generation_operations
        DROP CONSTRAINT fk_generation_cv_owner,
        DROP CONSTRAINT ck_generation_owner_reference,
        DROP CONSTRAINT ai_generation_operations_owner_kind_check,
        DROP COLUMN cv_generation_id,
        ADD CONSTRAINT ai_generation_operations_owner_kind_check
          CHECK(owner_kind IN ('chat','teacher','flashcard_library')),
        ADD CONSTRAINT ck_generation_owner_reference CHECK(${previousOwners});
    `);
  }
}
