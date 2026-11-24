import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNodiaCvGenerations1793970000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE nodia_cv_generations (
        id uuid PRIMARY KEY,
        owner_user_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        auth_session_public_id uuid REFERENCES auth_sessions(public_id) ON DELETE SET NULL,
        profile_id uuid REFERENCES nodia_cv_profiles(id) ON DELETE SET NULL,
        profile_revision integer CHECK(profile_revision >= 1),
        request_key uuid NOT NULL,
        request_hash char(64),
        state text NOT NULL CHECK(state IN ('queued','running','ready','failed','unknown','expired')),
        language text NOT NULL CHECK(language IN ('es','en')),
        purpose_version text NOT NULL,
        prompt_version text NOT NULL,
        profile_snapshot jsonb CHECK(profile_snapshot IS NULL OR octet_length(profile_snapshot::text)<=131072),
        offer_text text CHECK(octet_length(offer_text)<=24576),
        vacancy_title varchar(160),
        vacancy_company varchar(160),
        selection_snapshot jsonb,
        configuration_generation text NOT NULL,
        session_generation text NOT NULL,
        resource_key text NOT NULL,
        scope_hash char(64) NOT NULL,
        qualification boolean NOT NULL DEFAULT false,
        draft jsonb CHECK(draft IS NULL OR octet_length(draft::text)<=262144),
        error_code text,
        queue_expires_at timestamptz NOT NULL,
        expires_at timestamptz NOT NULL,
        lease_until timestamptz,
        deadline_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        UNIQUE(id, owner_user_id),
        UNIQUE(owner_user_id, request_key),
        CHECK((state='ready')=(draft IS NOT NULL)),
        CHECK(state<>'running' OR (lease_until IS NOT NULL AND deadline_at IS NOT NULL)),
        CHECK(state<>'expired' OR (profile_snapshot IS NULL AND offer_text IS NULL AND draft IS NULL
           AND vacancy_title IS NULL AND vacancy_company IS NULL AND request_hash IS NULL
           AND selection_snapshot IS NULL AND profile_id IS NULL))
      );
      CREATE INDEX ix_nodia_cv_generations_queued ON nodia_cv_generations(created_at,id) WHERE state='queued';
      CREATE INDEX ix_nodia_cv_generations_profile ON nodia_cv_generations(profile_id) WHERE profile_id IS NOT NULL;
      CREATE INDEX ix_nodia_cv_generations_expiring ON nodia_cv_generations(expires_at) WHERE state<>'expired';
      CREATE TABLE nodia_cv_generation_qualifications (
        scope_hash char(64) PRIMARY KEY,
        generation_id uuid NOT NULL UNIQUE REFERENCES nodia_cv_generations(id) ON DELETE RESTRICT,
        response_hash char(64) NOT NULL,
        checked_at timestamptz NOT NULL DEFAULT clock_timestamp()
      );
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE nodia_cv_generations, nodia_cv_generation_qualifications IN ACCESS EXCLUSIVE MODE;
      DO $guard$ BEGIN
        IF EXISTS(SELECT 1 FROM nodia_cv_generations) THEN
          RAISE EXCEPTION 'Preserve Nodia CV generation receipts before reverting';
        END IF;
      END $guard$;
      DROP TABLE nodia_cv_generation_qualifications, nodia_cv_generations;
    `);
  }
}
