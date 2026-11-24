import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNodiaCvPdfVersions1794000000000 implements MigrationInterface {
  async up(runner: QueryRunner) {
    await runner.query(`
      CREATE TABLE nodia_cv_draft_pdfs (
        id uuid PRIMARY KEY,
        generation_id uuid NOT NULL,
        owner_user_id bigint NOT NULL,
        review_revision integer NOT NULL CHECK (review_revision > 0),
        template text NOT NULL CHECK (template IN ('classic','compact')),
        language text NOT NULL CHECK (language IN ('es','en')),
        format text NOT NULL DEFAULT 'a4' CHECK (format = 'a4'),
        renderer varchar(120) NOT NULL CHECK (length(renderer) > 0),
        sha256 char(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
        page_count integer NOT NULL CHECK (page_count BETWEEN 1 AND 4),
        extracted_text text NOT NULL CHECK (octet_length(extracted_text) BETWEEN 1 AND 100000),
        missing_contact boolean NOT NULL,
        bytes bytea NOT NULL CHECK (octet_length(bytes) BETWEEN 1 AND 262144),
        FOREIGN KEY (generation_id, owner_user_id)
          REFERENCES nodia_cv_generations(id, owner_user_id) ON DELETE CASCADE,
        UNIQUE (generation_id, review_revision, template, renderer)
      );

      CREATE TABLE nodia_cv_version_counters (
        owner_user_id bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        last_number integer NOT NULL DEFAULT 0 CHECK (last_number >= 0)
      );

      CREATE TABLE nodia_cv_versions (
        id uuid PRIMARY KEY,
        owner_user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        version_number integer NOT NULL CHECK (version_number > 0),
        source_artifact_id uuid NOT NULL,
        profile_name varchar(160) NOT NULL,
        vacancy_title varchar(160),
        vacancy_company varchar(160),
        language text NOT NULL CHECK (language IN ('es','en')),
        template text NOT NULL CHECK (template IN ('classic','compact')),
        created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot)='object' AND octet_length(snapshot::text)<=262144),
        UNIQUE (id, owner_user_id),
        UNIQUE (owner_user_id, version_number),
        UNIQUE (owner_user_id, source_artifact_id)
      );

      CREATE TABLE nodia_cv_version_pdfs (
        version_id uuid PRIMARY KEY,
        owner_user_id bigint NOT NULL,
        format text NOT NULL CHECK (format = 'a4'),
        renderer varchar(120) NOT NULL CHECK (length(renderer) > 0),
        sha256 char(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
        page_count integer NOT NULL CHECK (page_count BETWEEN 1 AND 4),
        extracted_text text NOT NULL CHECK (octet_length(extracted_text) BETWEEN 1 AND 100000),
        missing_contact boolean NOT NULL,
        bytes bytea NOT NULL CHECK (octet_length(bytes) BETWEEN 1 AND 262144),
        FOREIGN KEY (version_id, owner_user_id)
          REFERENCES nodia_cv_versions(id, owner_user_id) ON DELETE CASCADE
      );

      -- Receipt identity survives deleting the version so a lost reply cannot recreate it.
      CREATE TABLE nodia_cv_version_save_receipts (
        owner_user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        request_key uuid NOT NULL,
        version_id uuid NOT NULL,
        request_hash char(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
        PRIMARY KEY (owner_user_id, request_key)
      );

      CREATE FUNCTION purge_nodia_cv_draft_pdfs() RETURNS trigger LANGUAGE plpgsql AS $purge$
      BEGIN
        DELETE FROM nodia_cv_draft_pdfs
        WHERE generation_id=NEW.id AND owner_user_id=NEW.owner_user_id;
        RETURN NEW;
      END;
      $purge$;

      CREATE TRIGGER purge_nodia_cv_draft_pdfs_on_change
        AFTER UPDATE OF state, review_revision, profile_id ON nodia_cv_generations
        FOR EACH ROW
        WHEN (OLD.state='ready' AND (
          NEW.state<>'ready' OR
          NEW.review_revision IS DISTINCT FROM OLD.review_revision OR
          NEW.profile_id IS DISTINCT FROM OLD.profile_id
        ))
        EXECUTE FUNCTION purge_nodia_cv_draft_pdfs();
    `);
  }

  async down(runner: QueryRunner) {
    await runner.query(`
      LOCK TABLE nodia_cv_generations, nodia_cv_draft_pdfs, nodia_cv_versions,
        nodia_cv_version_pdfs, nodia_cv_version_save_receipts, nodia_cv_version_counters
        IN ACCESS EXCLUSIVE MODE;
      DO $guard$ BEGIN
        IF EXISTS(SELECT 1 FROM nodia_cv_versions)
          OR EXISTS(SELECT 1 FROM nodia_cv_draft_pdfs)
          OR EXISTS(SELECT 1 FROM nodia_cv_version_save_receipts) THEN
          RAISE EXCEPTION 'Preserve Nodia CV PDFs, versions and save receipts before reverting';
        END IF;
      END $guard$;
      DROP TRIGGER purge_nodia_cv_draft_pdfs_on_change ON nodia_cv_generations;
      DROP FUNCTION purge_nodia_cv_draft_pdfs();
      DROP TABLE nodia_cv_version_save_receipts, nodia_cv_version_pdfs, nodia_cv_versions,
        nodia_cv_version_counters, nodia_cv_draft_pdfs;
    `);
  }
}
