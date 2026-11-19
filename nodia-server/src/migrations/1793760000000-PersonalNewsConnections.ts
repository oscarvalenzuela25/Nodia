import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PersonalNewsConnections1793760000000 implements MigrationInterface {
  name = 'PersonalNewsConnections1793760000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE news_personal_connections (
        user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider text NOT NULL CHECK (provider = 'dev-community'),
        credential_version uuid NOT NULL,
        credential_ciphertext text,
        state text NOT NULL DEFAULT 'disconnected'
          CHECK (state IN ('disconnected', 'connected', 'reconnect_required')),
        account_name varchar(80),
        last_tested_at timestamptz,
        last_test_error_code text,
        last_refresh_attempt_at timestamptz,
        last_refresh_success_at timestamptz,
        last_refresh_error_code text,
        next_refresh_at timestamptz,
        retry_until timestamptz,
        retry_source text CHECK (retry_source IN ('provider', 'local')),
        snapshot_expires_at timestamptz,
        snapshot_status text CHECK (snapshot_status IN ('updated', 'empty', 'no_followed_tags')),
        articles jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (
          jsonb_typeof(articles) = 'array' AND jsonb_array_length(articles) <= 24
        ),
        operation_lease_id uuid,
        operation_lease_until timestamptz,
        connect_lease_id uuid,
        connect_lease_until timestamptz,
        PRIMARY KEY (user_id, provider),
        CHECK ((state = 'connected') = (credential_ciphertext IS NOT NULL)),
        CHECK ((state = 'connected') = (account_name IS NOT NULL)),
        CHECK ((retry_until IS NULL) = (retry_source IS NULL)),
        CHECK ((snapshot_expires_at IS NULL) = (snapshot_status IS NULL)),
        CHECK ((operation_lease_id IS NULL) = (operation_lease_until IS NULL)),
        CHECK ((connect_lease_id IS NULL) = (connect_lease_until IS NULL))
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      LOCK TABLE news_personal_connections IN ACCESS EXCLUSIVE MODE;
      DO $guard$
      BEGIN
        IF EXISTS (SELECT 1 FROM news_personal_connections) THEN
          RAISE EXCEPTION 'Personal News data must be preserved before dropping the table';
        END IF;
      END $guard$;
      DROP TABLE news_personal_connections;
    `);
  }
}
