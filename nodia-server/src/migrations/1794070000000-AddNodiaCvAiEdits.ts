import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNodiaCvAiEdits1794070000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE nodia_cv_generations ADD COLUMN edit_input jsonb;

      ALTER TABLE nodia_cv_generations ADD CONSTRAINT ck_nodia_cv_ai_edit CHECK(
        (state='expired' OR (purpose_version='cv_tailoring_edit')=(edit_input IS NOT NULL))
        AND (edit_input IS NULL OR coalesce((state<>'expired' AND NOT qualification
          AND purpose_version='cv_tailoring_edit' AND prompt_version='cv-edit/1'
          AND jsonb_typeof(edit_input)='object' AND octet_length(edit_input::text)<=8192
          AND (edit_input-ARRAY['base_generation_id','base_revision','instructions'])='{}'::jsonb
          AND edit_input->>'base_generation_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          AND edit_input->>'base_generation_id'<>id::text
          AND jsonb_typeof(edit_input->'base_revision')='number'
          AND edit_input->>'base_revision' ~ '^[1-9][0-9]{0,9}$'
          AND jsonb_typeof(edit_input->'instructions')='string'
          AND octet_length(edit_input->>'instructions') BETWEEN 1 AND 2048
        ),false))
      );
      CREATE INDEX ix_nodia_cv_unresolved_edit ON nodia_cv_generations(owner_user_id,request_hash)
        WHERE edit_input IS NOT NULL AND state IN ('queued','running','unknown');

      CREATE FUNCTION purge_nodia_cv_edit_input() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        NEW.edit_input := NULL;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER purge_nodia_cv_edit_input_on_expiry
        BEFORE UPDATE OF state ON nodia_cv_generations
        FOR EACH ROW WHEN (NEW.state='expired' AND NEW.edit_input IS NOT NULL)
        EXECUTE FUNCTION purge_nodia_cv_edit_input();
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE nodia_cv_generations IN ACCESS EXCLUSIVE MODE;
      DO $guard$ BEGIN
        IF EXISTS(SELECT 1 FROM nodia_cv_generations WHERE edit_input IS NOT NULL) THEN
          RAISE EXCEPTION 'Preserve Nodia CV AI edits before reverting';
        END IF;
      END $guard$;
      DROP TRIGGER purge_nodia_cv_edit_input_on_expiry ON nodia_cv_generations;
      DROP FUNCTION purge_nodia_cv_edit_input();
      DROP INDEX ix_nodia_cv_unresolved_edit;
      ALTER TABLE nodia_cv_generations DROP CONSTRAINT ck_nodia_cv_ai_edit,
        DROP COLUMN edit_input;
    `);
  }
}
