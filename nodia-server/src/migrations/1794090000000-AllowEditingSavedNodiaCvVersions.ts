import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowEditingSavedNodiaCvVersions1794090000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE nodia_cv_generations ADD COLUMN source_version jsonb;
      ALTER TABLE nodia_cv_generations ADD CONSTRAINT ck_nodia_cv_version_draft CHECK (
        (state='expired' OR purpose_version<>'cv_saved_version_copy' OR source_version IS NOT NULL)
        AND (source_version IS NULL OR coalesce((
          jsonb_typeof(source_version)='object'
          AND (source_version-ARRAY['id','template','offer_sha256'])='{}'::jsonb
          AND source_version->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          AND source_version->>'template' IN ('classic','compact')
          AND source_version->>'offer_sha256' ~ '^[0-9a-f]{64}$'
          AND state<>'expired' AND NOT qualification AND profile_id IS NULL
          AND profile_snapshot->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          AND profile_revision IS NOT NULL AND offer_text=''
          AND ((purpose_version='cv_saved_version_copy' AND state='ready' AND selection_snapshot IS NULL)
            OR purpose_version='cv_tailoring_edit')
        ),false))
      );

      CREATE FUNCTION purge_nodia_cv_version_draft_source() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        NEW.source_version := NULL;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER purge_nodia_cv_version_draft_source_on_expiry
        BEFORE UPDATE OF state ON nodia_cv_generations
        FOR EACH ROW WHEN (NEW.state='expired' AND NEW.source_version IS NOT NULL)
        EXECUTE FUNCTION purge_nodia_cv_version_draft_source();
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE nodia_cv_generations IN ACCESS EXCLUSIVE MODE;
      DO $guard$ BEGIN
        IF EXISTS(SELECT 1 FROM nodia_cv_generations WHERE source_version IS NOT NULL) THEN
          RAISE EXCEPTION 'Preserve saved Nodia CV draft copies before reverting';
        END IF;
      END $guard$;
      DROP TRIGGER purge_nodia_cv_version_draft_source_on_expiry ON nodia_cv_generations;
      DROP FUNCTION purge_nodia_cv_version_draft_source();
      ALTER TABLE nodia_cv_generations DROP CONSTRAINT ck_nodia_cv_version_draft,
        DROP COLUMN source_version;
    `);
  }
}
