import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNodiaCvProfiles1793960000000 implements MigrationInterface {
  name = 'CreateNodiaCvProfiles1793960000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE nodia_cv_profiles (
        id uuid PRIMARY KEY,
        owner_user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
        schema_version smallint NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
        profile_name varchar(120) NOT NULL,
        full_name varchar(160) NOT NULL,
        professional_title varchar(160),
        data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX ix_nodia_cv_profiles_owner_updated
        ON nodia_cv_profiles (owner_user_id, updated_at DESC, id DESC);

      CREATE TABLE nodia_cv_profile_create_receipts (
        owner_user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        request_key uuid NOT NULL,
        profile_id uuid NOT NULL,
        request_hash varchar(64) CHECK (request_hash ~ '^[0-9a-f]{64}$'),
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (owner_user_id, request_key),
        CONSTRAINT uq_nodia_cv_profile_receipts_profile UNIQUE (profile_id)
      );
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE nodia_cv_profile_create_receipts, nodia_cv_profiles
        IN ACCESS EXCLUSIVE MODE;
      DO $guard$
      BEGIN
        IF EXISTS (SELECT 1 FROM nodia_cv_profiles)
          OR EXISTS (SELECT 1 FROM nodia_cv_profile_create_receipts) THEN
          RAISE EXCEPTION 'Preserve Nodia CV profiles and creation receipts before reverting';
        END IF;
      END $guard$;
      DROP TABLE nodia_cv_profile_create_receipts, nodia_cv_profiles;
    `);
  }
}
